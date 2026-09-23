import { Router } from 'express';
import { pool, queryOne } from '../db';
import { HttpError, wrap } from '../utils';
import { asOptStr, asBool, asOptFloat } from '../finance';
import { requireRole, getCurrentUser } from '../auth';
import { ROLES } from '../types';
import type { AuthRequest } from '../auth';
import type { CarpetRow, UserRow } from '../types';
import { serializeCarpet } from '../serialize';
import { createTransactionCore, CreateData } from './transactions';

const router = Router();
const M = ROLES.slice(0, 2); // ADMIN, MANAGER
const RETENTION_DAYS = 1;

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
      conds.push(`receiver_id = $${params.length}`);
    }
    if (status === 'received' || status === 'released') {
      params.push(status);
      conds.push(`status = $${params.length}`);
    }
    const rows = (
      await pool.query(
        `SELECT * FROM carpets ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''} ORDER BY created_at DESC`,
        params,
      )
    ).rows as CarpetRow[];
    res.json(rows.map(serializeCarpet));
  }),
);

function parseCarpetCreate(body: Record<string, unknown>): Partial<CarpetRow> {
  const receiver_id = Number(body.receiver_id);
  if (!Number.isInteger(receiver_id)) throw new HttpError(422, 'receiver_id must be an integer');
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
    image_data: asOptStr(body.image_data),
  };
}

// POST /carpets (receive)
router.post(
  '/',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const data = parseCarpetCreate(req.body || {});
    const receiver = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [data.receiver_id]);
    if (!receiver) throw new HttpError(404, 'Receiver not found');

    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const row = (
      await pool.query(
        `INSERT INTO carpets (created_at, receiver_id, characteristics, client_name, customer_phone,
           image_data, expected_price, cash_paid, mpesa_paid, is_washed, status, released_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,'received',NULL) RETURNING *`,
        [
          now,
          data.receiver_id,
          data.characteristics,
          data.client_name,
          data.customer_phone,
          data.image_data,
          data.expected_price,
          data.cash_paid,
          data.mpesa_paid,
        ],
      )
    ).rows[0] as CarpetRow;
    res.status(200).json(serializeCarpet(row));
  }),
);

// PATCH /carpets/:id/wash
router.patch(
  '/:id/wash',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Carpet not found');
    const up = await pool.query('UPDATE carpets SET is_washed = true WHERE id = $1 RETURNING *', [id]);
    if (!up.rows.length) throw new HttpError(404, 'Carpet not found');
    res.json(serializeCarpet(up.rows[0] as CarpetRow));
  }),
);

// PATCH /carpets/:id
router.patch(
  '/:id',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Carpet not found');
    const carpet = await queryOne<CarpetRow>('SELECT * FROM carpets WHERE id = $1', [id]);
    if (!carpet) throw new HttpError(404, 'Carpet not found');

    const body = req.body || {};
    const sets: string[] = [];
    const params: any[] = [];
    const put = (k: string, v: any) => {
      if (v !== undefined) {
        params.push(v);
        sets.push(`${k} = $${params.length}`);
      }
    };
    if (body.is_washed !== undefined) put('is_washed', asBool(body.is_washed, 'is_washed'));
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
    if (body.image_data !== undefined) put('image_data', asOptStr(body.image_data));

    params.push(id);
    if (!sets.length) return res.json(serializeCarpet(carpet));
    const rows = (
      await pool.query(`UPDATE carpets SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params)
    ).rows as CarpetRow[];
    res.json(serializeCarpet(rows[0]));
  }),
);

// POST /carpets/:id/release
router.post(
  '/:id/release',
  wrap(async (req: AuthRequest, res) => {
    const user = await requireRole(req, M);
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
          washer_id: carpet.receiver_id,
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
            receiver_id: carpet.receiver_id,
            customer_phone: carpet.customer_phone,
          },
        };
        await createTransactionCore(txData, user);
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