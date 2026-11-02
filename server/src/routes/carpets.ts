import { Router } from 'express';
import { pool, queryOne } from '../db';
import { HttpError, wrap } from '../utils';
import { asOptStr, asBool, asOptFloat } from '../finance';
import { requireRole, getCurrentUser } from '../auth';
import { ROLES } from '../types';
import type { AuthRequest } from '../auth';
import type { CarpetRow, UserRow } from '../types';
import { serializeCarpet, serializeCarpetList } from '../serialize';
import { createTransactionCore, CreateData } from './transactions';

const router = Router();
// Only admin and manager can receive, edit, wash or release carpets;
// employees get read-only access.
const M = ROLES.slice(0, 2); // ADMIN, MANAGER
const RETENTION_DAYS = 7;

// Admin/manager manage everything; employees manage carpets they received or
// logged themselves.
function canTouch(user: UserRow, c: Pick<CarpetRow, 'receiver_id' | 'submitter_id'>): boolean {
  if (user.role.toUpperCase() !== 'EMPLOYEE') return true;
  return c.receiver_id === user.id || (c.submitter_id ?? null) === user.id;
}

async function autoDeleteReleased(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000);
  const cutoffStr = cutoff.toISOString().replace('T', ' ').replace('Z', '');
  await pool.query("DELETE FROM carpets WHERE status = 'released' AND released_at < $1::timestamp", [
    cutoffStr,
  ]);
}

// GET /carpets
router.get(
  '/',
  wrap(async (req: AuthRequest, res) => {
    await autoDeleteReleased();
    const user = await getCurrentUser(req);
    const status = req.query.status as string | undefined;

    const conds: string[] = [];
    const params: any[] = [];
    if (user.role.toUpperCase() === 'EMPLOYEE') {
      params.push(user.id);
      conds.push(`(receiver_id = $${params.length} OR submitter_id = $${params.length})`);
    }
    if (status && ['received', 'washed', 'ready', 'released'].includes(status)) {
      params.push(status);
      conds.push(`status = $${params.length}`);
    }
    const rows = (
      await pool.query(
        `SELECT * FROM carpets ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''} ORDER BY created_at DESC`,
        params,
      )
    ).rows as CarpetRow[];
    // Lists return thumbnails only, so the payload stays small even when many
    // carpets are held at once. Fetch /carpets/:id for the full photo.
    res.json(rows.map(serializeCarpetList));
  }),
);

// GET /carpets/stats - aggregate + per-employee + per-day carpet stats
router.get(
  '/stats',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);

    const aggregate = (
      await pool.query(
        `SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'received') as received,
          COUNT(*) FILTER (WHERE status = 'washed') as washed,
          COUNT(*) FILTER (WHERE status = 'ready') as ready,
          COUNT(*) FILTER (WHERE status = 'released') as released
        FROM carpets`,
      )
    ).rows[0];

    const total = Number(aggregate.total || 0);
    const received = Number(aggregate.received || 0);
    const washed = Number(aggregate.washed || 0);
    const ready = Number(aggregate.ready || 0);
    const released = Number(aggregate.released || 0);
    const unwashed = received + (total - received - washed - ready - released);

    const perEmp = (
      await pool.query(
        `SELECT u.id, u.full_name, u.abbreviation,
          COUNT(c.id) as total,
          COUNT(*) FILTER (WHERE c.status = 'received') as received,
          COUNT(*) FILTER (WHERE c.status = 'washed') as washed,
          COUNT(*) FILTER (WHERE c.status = 'ready') as ready,
          COUNT(*) FILTER (WHERE c.status = 'released') as released
        FROM users u
        LEFT JOIN carpets c ON c.receiver_id = u.id
        WHERE u.role = 'EMPLOYEE'
        GROUP BY u.id, u.full_name, u.abbreviation
        ORDER BY u.full_name`,
      )
    ).rows;

    const employees = perEmp.map((e: any) => {
      const t = Number(e.total || 0);
      const r = Number(e.received || 0);
      const w = Number(e.washed || 0);
      const rd = Number(e.ready || 0);
      const rel = Number(e.released || 0);
      const un = r + (t - r - w - rd - rel);
      return {
        id: e.id,
        name: e.full_name,
        abbreviation: e.abbreviation,
        total: t,
        received: r,
        washed: w,
        ready: rd,
        released: rel,
        unwashed: un,
      };
    });

    // Daily breakdown for the last 7 days
    const daily = (
      await pool.query(
        `SELECT
          date(created_at) as day,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'received') as received,
          COUNT(*) FILTER (WHERE status = 'washed') as washed,
          COUNT(*) FILTER (WHERE status = 'ready') as ready,
          COUNT(*) FILTER (WHERE status = 'released') as released
        FROM carpets
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY date(created_at)
        ORDER BY date(created_at) DESC`,
      )
    ).rows;

    const dailyStats = daily.map((d: any) => ({
      date: d.day,
      total: Number(d.total || 0),
      received: Number(d.received || 0),
      washed: Number(d.washed || 0),
      ready: Number(d.ready || 0),
      released: Number(d.released || 0),
    }));

    res.json({
      total,
      received,
      washed,
      ready,
      released,
      unwashed,
      employees,
      daily: dailyStats,
    });
  }),
);

// GET /carpets/:id  (full carpet incl. the original photo, for previews)
router.get(
  '/:id',
  wrap(async (req: AuthRequest, res) => {
    const user = await getCurrentUser(req);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Carpet not found');
    const carpet = await queryOne<CarpetRow>('SELECT * FROM carpets WHERE id = $1', [id]);
    if (!carpet) throw new HttpError(404, 'Carpet not found');
    if (!canTouch(user, carpet)) throw new HttpError(403, 'Not your carpet');
    res.json(serializeCarpet(carpet));
  }),
);

function parseCarpetCreate(body: Record<string, unknown>): Partial<CarpetRow> {
  const image_data = asOptStr(body.image_data);
  if (!image_data || image_data.length < 20) {
    throw new HttpError(422, 'a photo of the carpet is required on arrival');
  }
  let receiver_id: number | null = null;
  if (body.receiver_id !== undefined && body.receiver_id !== null && body.receiver_id !== '') {
    receiver_id = Number(body.receiver_id);
    if (!Number.isInteger(receiver_id)) throw new HttpError(422, 'receiver_id must be an integer');
  }
  const expected_price = asOptFloat(body.expected_price, 'expected_price') ?? 0;
  const cash_paid = asOptFloat(body.cash_paid, 'cash_paid') ?? 0;
  const mpesa_paid = asOptFloat(body.mpesa_paid, 'mpesa_paid') ?? 0;
  for (const [k, v] of [
    ['expected_price', expected_price],
    ['cash_paid', cash_paid],
    ['mpesa_paid', mpesa_paid],
  ] as const) {
    if (v < 0) throw new HttpError(422, `${k} must be >= 0`);
  }
  return {
    receiver_id,
    expected_price,
    cash_paid,
    mpesa_paid,
    characteristics: asOptStr(body.characteristics),
    client_name: asOptStr(body.client_name),
    customer_phone: asOptStr(body.customer_phone),
    image_data,
    image_thumb: asOptStr(body.image_thumb) ?? image_data,
  };
}

// POST /carpets (receive) - admin/manager log an arriving carpet with a photo;
// the receiver can be chosen now or later, ownership is tracked via submitter.
router.post(
  '/',
  wrap(async (req: AuthRequest, res) => {
    const user = await requireRole(req, M);
    const data = parseCarpetCreate(req.body || {});
    let receiver_id: number | null = data.receiver_id ?? null;
    if (receiver_id !== null) {
      const receiver = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [receiver_id]);
      if (!receiver) throw new HttpError(404, 'Receiver not found');
    }

    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const row = (
      await pool.query(
        `INSERT INTO carpets (created_at, receiver_id, submitter_id, characteristics, client_name, customer_phone,
           image_data, image_thumb, expected_price, cash_paid, mpesa_paid, is_washed, status, released_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,'received',NULL) RETURNING *`,
        [
          now,
          receiver_id,
          user.id,
          data.characteristics,
          data.client_name,
          data.customer_phone,
          data.image_data,
          data.image_thumb,
          data.expected_price,
          data.cash_paid,
          data.mpesa_paid,
        ],
      )
    ).rows[0] as CarpetRow;
    res.status(200).json(serializeCarpet(row));
  }),
);

// PATCH /carpets/:id/wash (mark washed; admin/manager)
router.patch(
  '/:id/wash',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Carpet not found');
    const carpet = await queryOne<CarpetRow>('SELECT * FROM carpets WHERE id = $1', [id]);
    if (!carpet) throw new HttpError(404, 'Carpet not found');
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const up = await pool.query(
      `UPDATE carpets SET is_washed = true, status = 'washed', washed_at = COALESCE(washed_at, $2)
       WHERE id = $1 RETURNING *`,
      [id, now],
    );
    res.json(serializeCarpet(up.rows[0] as CarpetRow));
  }),
);

// PATCH /carpets/:id (admin/manager: pick receiver later, correct details,
// advance the status flow received -> washed -> ready, add per-status photos)
router.patch(
  '/:id',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Carpet not found');
    const carpet = await queryOne<CarpetRow>('SELECT * FROM carpets WHERE id = $1', [id]);
    if (!carpet) throw new HttpError(404, 'Carpet not found');
    if (carpet.status === 'released') throw new HttpError(400, 'Released carpets cannot be edited');

    const body = req.body || {};
    const sets: string[] = [];
    const params: any[] = [];
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const put = (k: string, v: any) => {
      if (v !== undefined) {
        params.push(v);
        sets.push(`${k} = $${params.length}`);
      }
    };
    // Status flow. 'released' is done through the dedicated release action so
    // the payment / client-debt side effects stay in one place.
    if (body.status !== undefined) {
      const st = asOptStr(body.status)?.toLowerCase();
      if (!st || !['received', 'washed', 'ready'].includes(st)) {
        throw new HttpError(422, 'status must be one of: received, washed, ready (released is done via release)');
      }
      if (st === 'washed') {
        put('status', 'washed');
        put('is_washed', true);
        put('washed_at', now);
      } else if (st === 'ready') {
        put('status', 'ready');
        put('is_washed', true);
        put('ready_at', now);
        put('washed_at', now); // being ready implies it went through the wash
      } else {
        put('status', 'received');
      }
    }
    // Optional washed photo (full + thumbnail).
    const optPhoto = (fullKey: string, thumbKey: string, label: string) => {
      if (body[fullKey] !== undefined && body[fullKey] !== null && body[fullKey] !== '') {
        const v = asOptStr(body[fullKey])!;
        if (v.length < 20) throw new HttpError(422, `${label} photo is too short`);
        put(fullKey, v);
        if (body[thumbKey] === undefined || body[thumbKey] === null || body[thumbKey] === '') {
          put(thumbKey, v);
        }
      }
      if (body[thumbKey] !== undefined && body[thumbKey] !== null && body[thumbKey] !== '') {
        const v = asOptStr(body[thumbKey])!;
        if (v.length < 20) throw new HttpError(422, `${label} photo is too short`);
        put(thumbKey, v);
      }
    };
    optPhoto('image_washed', 'image_washed_thumb', 'washed');
    optPhoto('image_ready', 'image_ready_thumb', 'ready');
    if (body.is_washed !== undefined) put('is_washed', asBool(body.is_washed, 'is_washed'));
    if (body.receiver_id !== undefined && body.receiver_id !== null && body.receiver_id !== '') {
      const rid = Number(body.receiver_id);
      if (!Number.isInteger(rid)) throw new HttpError(422, 'receiver_id must be an integer');
      const rec = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [rid]);
      if (!rec) throw new HttpError(404, 'Receiver not found');
      put('receiver_id', rid);
    } else if (body.receiver_id === null) {
      put('receiver_id', null);
    }
    if (body.characteristics !== undefined) put('characteristics', asOptStr(body.characteristics));
    if (body.client_name !== undefined) put('client_name', asOptStr(body.client_name));
    if (body.expected_price !== undefined) {
      const v = asOptFloat(body.expected_price, 'expected_price');
      if (v !== undefined && v < 0) throw new HttpError(422, 'expected_price must be >= 0');
      put('expected_price', v);
    }
    if (body.cash_paid !== undefined) {
      const v = asOptFloat(body.cash_paid, 'cash_paid');
      if (v !== undefined && v < 0) throw new HttpError(422, 'cash_paid must be >= 0');
      put('cash_paid', v);
    }
    if (body.mpesa_paid !== undefined) {
      const v = asOptFloat(body.mpesa_paid, 'mpesa_paid');
      if (v !== undefined && v < 0) throw new HttpError(422, 'mpesa_paid must be >= 0');
      put('mpesa_paid', v);
    }
    if (body.customer_phone !== undefined) put('customer_phone', asOptStr(body.customer_phone));
    if (body.image_data !== undefined || body.image_thumb !== undefined) {
      if (body.image_data !== undefined) {
        const v = asOptStr(body.image_data);
        if (v && v.length < 20) throw new HttpError(422, 'photo is too short');
        put('image_data', v);
        // Keep the thumbnail in sync when only the full photo is replaced.
        if (body.image_thumb === undefined) put('image_thumb', v);
      }
      if (body.image_thumb !== undefined) {
        const v = asOptStr(body.image_thumb);
        if (v && v.length < 20) throw new HttpError(422, 'photo is too short');
        put('image_thumb', v);
      }
    }

    params.push(id);
    if (!sets.length) return res.json(serializeCarpet(carpet));
    const rows = (
      await pool.query(`UPDATE carpets SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params)
    ).rows as CarpetRow[];
    res.json(serializeCarpet(rows[0]));
  }),
);

// POST /carpets/:id/release - the client may pick the carpet up even if it was
// never washed or never paid for; no one is short-charged for that choice.
router.post(
  '/:id/release',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Carpet not found');
    const carpet = await queryOne<CarpetRow>('SELECT * FROM carpets WHERE id = $1', [id]);
    if (!carpet) throw new HttpError(404, 'Carpet not found');
    if (carpet.status === 'released') throw new HttpError(400, 'Carpet already released');

    const body = req.body || {};
    if (body.cash_paid !== undefined) {
      const v = asOptFloat(body.cash_paid, 'cash_paid');
      if (v !== undefined && v < 0) throw new HttpError(422, 'cash_paid must be >= 0');
      if (v !== undefined) carpet.cash_paid = v;
    }
    if (body.mpesa_paid !== undefined) {
      const v = asOptFloat(body.mpesa_paid, 'mpesa_paid');
      if (v !== undefined && v < 0) throw new HttpError(422, 'mpesa_paid must be >= 0');
      if (v !== undefined) carpet.mpesa_paid = v;
    }
    if (body.customer_phone !== undefined) carpet.customer_phone = asOptStr(body.customer_phone);
    if (body.client_name !== undefined) carpet.client_name = asOptStr(body.client_name);

    // The washer can be picked now, or falls back to whoever received/was assigned.
    const washerId =
      body.washer_id !== undefined && body.washer_id !== null && body.washer_id !== ''
        ? Number(body.washer_id)
        : carpet.receiver_id ?? carpet.submitter_id;
    if (!Number.isInteger(washerId)) {
      throw new HttpError(422, 'choose who washes the carpet (receiver or washer)');
    }
    const washer = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [washerId]);
    if (!washer) throw new HttpError(404, 'Receiver not found');

    carpet.status = 'released';
    carpet.released_at = new Date();

    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE carpets SET cash_paid=$1, mpesa_paid=$2, customer_phone=$3, client_name=$4,
           status='released', released_at=$5 WHERE id=$6`,
        [
          carpet.cash_paid,
          carpet.mpesa_paid,
          carpet.customer_phone,
          carpet.client_name,
          now,
          id,
        ],
      );

      if (carpet.expected_price > 0 || carpet.cash_paid + carpet.mpesa_paid > 0) {
        const txData: CreateData = {
          washer_id: washerId!,
          category: 'carpet',
          expected_price: carpet.expected_price,
          cash_paid: carpet.cash_paid,
          mpesa_paid: carpet.mpesa_paid,
          mpesa_transaction_id: null,
          mpesa_sender_name: null,
          manual_tip: 0,
          tip_method: 'cash',
          misc_amount: 0,
          misc_description: null,
          has_car_wash: true,
          has_vacuum: false,
          has_engine_wash: false,
          plate_number: null,
          custom_category: null,
          carpet_metadata: {
            characteristics: carpet.characteristics || 'Carpet',
            // The commission follows the washer, but the carpet record should
            // still say who actually received it (picked later or never).
            receiver_id: carpet.receiver_id ?? carpet.submitter_id ?? washerId!,
            customer_phone: carpet.customer_phone,
          },
        };
        await createTransactionCore(txData, req.user!, { employeeBearsShortfall: false });
      }

      // Unpaid balance is the customer's responsibility, not the employee's.
      // Record it as a client debt so it can be collected from the Debtors list.
      const remaining =
        carpet.expected_price - carpet.cash_paid - carpet.mpesa_paid;
      if (remaining > 0) {
        const clientName =
          carpet.client_name || carpet.characteristics || 'Carpet customer';
        await client.query(
          `INSERT INTO client_debts (client_name, customer_phone, description, amount, paid, date, paid_date, notes, created_at)
           VALUES ($1,$2,$3,$4,0,$5,NULL,$6,$5)`,
          [
            clientName,
            carpet.customer_phone,
            `Carpet release - ${carpet.characteristics || 'Carpet'}`,
            remaining,
            now,
            `Balance after release of carpet #${id} for ${clientName}`,
          ],
        );
      }

      await client.query('COMMIT');
      const refreshed = await queryOne<CarpetRow>('SELECT * FROM carpets WHERE id = $1', [id]);
      res.json(serializeCarpet(refreshed!));
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }),
);

// DELETE /carpets/:id
router.delete(
  '/:id',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Carpet not found');
    const del = await pool.query('DELETE FROM carpets WHERE id = $1', [id]);
    if (!del.rowCount) throw new HttpError(404, 'Carpet not found');
    res.json({ message: 'Carpet deleted' });
  }),
);

export default router;