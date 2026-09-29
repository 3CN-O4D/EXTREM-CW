import { Router } from 'express';
import { pool, queryOne } from '../db';
import { HttpError, toUtcTimestamp, wrap } from '../utils';
import { asOptFloat, asOptStr, requireEnum } from '../finance';
import { requireRole, getCurrentUser } from '../auth';
import { ROLES, SERVICE_CATEGORIES } from '../types';
import { CarpetRow, UserRow } from '../types';
import type { AuthRequest } from '../auth';
import { createTransactionCore, CreateData } from './transactions';

interface ArrivalRow {
  id: number;
  created_at: Date;
  plate_number: string;
  category: string;
  expected_price: number;
  submitter_id: number;
  washer_id: number | null;
  cash_paid: number;
  mpesa_paid: number;
  status: string; // 'pending' | 'settled' | 'expired'
  debt_id: number | null;
  transaction_id: number | null;
  settled_at: Date | null;
}

const router = Router();
const ALL = ROLES; // employees may log arrivals and settle later
const M = ROLES.slice(0, 2);

const OVERDUE_HOURS = 24;

export function getStandardPrice(category: string): number {
  const base: Record<string, number> = {
    bicycle: 50, motorcycle: 70, taxi: 150, car: 200,
    midrange: 300, lorry: 500, carpet: 300, other: 0,
  };
  return base[category] ?? 0;
}

// Convert arrivals not settled within 24h into a shortfall debt for the
// employee who logged them. Runs lazily on the endpoints employees open, so
// no cron is needed on the serverless platform.
export async function expirePendingArrivals(): Promise<void> {
  const overdue = (
    await pool.query(
      `SELECT * FROM vehicle_arrivals
       WHERE status = 'pending' AND debt_id IS NULL
         AND created_at < now() - make_interval(hours => $1)`,
      [OVERDUE_HOURS],
    )
  ).rows as ArrivalRow[];
  for (const a of overdue) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
      const debt = await client.query(
        `INSERT INTO debts (employee_id, amount, service, date, paid, paid_date, notes)
         VALUES ($1,$2,'Vehicle',$3,0,NULL,$4) RETURNING id`,
        [
          a.submitter_id,
          a.expected_price,
          now,
          `Vehicle overdue (not settled within 24h) - ${a.plate_number} (arrival #${a.id})`,
        ],
      );
      await client.query(
        `UPDATE vehicle_arrivals SET status = 'expired', debt_id = $1 WHERE id = $2`,
        [debt.rows[0].id, a.id],
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

function serializeArrival(a: ArrivalRow): Record<string, unknown> {
  const old = a.created_at.getTime() < Date.now() - OVERDUE_HOURS * 3600000;
  const overdue = a.status !== 'settled' && old;
  return {
    id: a.id,
    created_at: toUtcTimestamp(a.created_at),
    plate_number: a.plate_number,
    category: a.category.toLowerCase(),
    expected_price: a.expected_price,
    submitter_id: a.submitter_id,
    washer_id: a.washer_id,
    cash_paid: a.cash_paid,
    mpesa_paid: a.mpesa_paid,
    status: a.status,
    debt_id: a.debt_id,
    transaction_id: a.transaction_id,
    settled_at: a.settled_at ? toUtcTimestamp(a.settled_at) : null,
    overdue,
    deadline: toUtcTimestamp(new Date(a.created_at.getTime() + OVERDUE_HOURS * 3600000)),
  };
}

function parsePlate(v: string | null | undefined): string {
  const p = (v ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9-]{2,}$/.test(p)) throw new HttpError(422, 'plate_number must be a valid plate');
  return p;
}

// GET /vehicles  (employees: their arrivals; admin/manager: everyone's)
router.get(
  '/',
  wrap(async (req: AuthRequest, res) => {
    const user = await getCurrentUser(req);
    await expirePendingArrivals();
    const conds: string[] = [];
    const params: any[] = [];
    if (user.role.toUpperCase() === 'EMPLOYEE') {
      params.push(user.id);
      conds.push(`submitter_id = $${params.length}`);
    }
    if (req.query.category) {
      params.push(String(req.query.category).toUpperCase());
      conds.push(`category = $${params.length}`);
    }
    const rows = (
      await pool.query(
        `SELECT * FROM vehicle_arrivals ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''} ORDER BY created_at DESC`,
        params,
      )
    ).rows as ArrivalRow[];
    res.json(rows.map(serializeArrival));
  }),
);

// POST /vehicles  (log an arrival — no money yet)
router.post(
  '/',
  wrap(async (req: AuthRequest, res) => {
    const user = await requireRole(req, ALL);
    const body = req.body || {};
    const plate_number = parsePlate(asOptStr(body.plate_number));
    const category = requireEnum(
      asOptStr(body.category)?.toLowerCase() ?? '',
      SERVICE_CATEGORIES.filter((c) => c !== 'carpet'),
      'category',
    );
    const expected_price = asOptFloat(body.expected_price, 'expected_price') ?? getStandardPrice(category);
    if (expected_price < 0) throw new HttpError(422, 'expected_price must be >= 0');
    let washer_id: number | null = null;
    if (body.washer_id !== undefined && body.washer_id !== null && body.washer_id !== '') {
      washer_id = Number(body.washer_id);
      if (!Number.isInteger(washer_id)) throw new HttpError(422, 'washer_id must be an integer');
    }

    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const row = (
      await pool.query(
        `INSERT INTO vehicle_arrivals (created_at, plate_number, category, expected_price, submitter_id, washer_id, cash_paid, mpesa_paid, status, debt_id, transaction_id, settled_at)
         VALUES ($1,$2,$3,$4,$5,$6,0,0,'pending',NULL,NULL,NULL) RETURNING *`,
        [now, plate_number, category.toUpperCase(), expected_price, user.id, washer_id],
      )
    ).rows[0] as ArrivalRow;
    res.status(200).json(serializeArrival(row));
  }),
);

// PATCH /vehicles/:id  (correct plate/category/price; pick washer later)
router.patch(
  '/:id',
  wrap(async (req: AuthRequest, res) => {
    const user = await getCurrentUser(req);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Arrival not found');
    const a = await queryOne<ArrivalRow>('SELECT * FROM vehicle_arrivals WHERE id = $1', [id]);
    if (!a) throw new HttpError(404, 'Arrival not found');
    if (a.status === 'settled') throw new HttpError(400, 'Arrival already settled');
    if (user.role.toUpperCase() === 'EMPLOYEE' && a.submitter_id !== user.id) {
      throw new HttpError(403, 'Not your arrival');
    }

    const body = req.body || {};
    const sets: string[] = [];
    const params: any[] = [];
    const put = (k: string, v: any) => {
      if (v !== undefined) {
        params.push(v);
        sets.push(`${k} = $${params.length}`);
      }
    };
    if (body.plate_number !== undefined) put('plate_number', parsePlate(asOptStr(body.plate_number)));
    if (body.category !== undefined) {
      put(
        'category',
        requireEnum(
          asOptStr(body.category)?.toLowerCase() ?? '',
          SERVICE_CATEGORIES.filter((c) => c !== 'carpet'),
          'category',
        ).toUpperCase(),
      );
    }
    if (body.expected_price !== undefined) {
      const v = asOptFloat(body.expected_price, 'expected_price');
      if (v !== undefined && v < 0) throw new HttpError(422, 'expected_price must be >= 0');
      put('expected_price', v);
    }
    if (body.washer_id !== undefined && body.washer_id !== null && body.washer_id !== '') {
      const v = Number(body.washer_id);
      if (!Number.isInteger(v)) throw new HttpError(422, 'washer_id must be an integer');
      put('washer_id', v);
    } else if (body.washer_id === null) {
      put('washer_id', null);
    }

    params.push(id);
    if (!sets.length) return res.json(serializeArrival(a));
    const rows = (
      await pool.query(`UPDATE vehicle_arrivals SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params)
    ).rows as ArrivalRow[];
    res.json(serializeArrival(rows[0]));
  }),
);

// POST /vehicles/:id/settle  (record the money: any cash + mpesa mix; washer optional)
router.post(
  '/:id/settle',
  wrap(async (req: AuthRequest, res) => {
    const actor = await requireRole(req, ALL);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Arrival not found');
    const a = await queryOne<ArrivalRow>('SELECT * FROM vehicle_arrivals WHERE id = $1', [id]);
    if (!a) throw new HttpError(404, 'Arrival not found');
    if (a.status === 'settled') throw new HttpError(400, 'Arrival already settled');
    if (actor.role.toUpperCase() === 'EMPLOYEE' && a.submitter_id !== actor.id) {
      throw new HttpError(403, 'Not your arrival');
    }

    const body = req.body || {};
    const cash_paid = asOptFloat(body.cash_paid, 'cash_paid') ?? 0;
    const mpesa_paid = asOptFloat(body.mpesa_paid, 'mpesa_paid') ?? 0;
    for (const [k, v] of [['cash_paid', cash_paid], ['mpesa_paid', mpesa_paid]] as const) {
      if (v < 0) throw new HttpError(422, `${k} must be >= 0`);
    }
    if (cash_paid + mpesa_paid === 0) throw new HttpError(422, 'enter at least some payment (cash or mpesa)');

    const washerId = a.washer_id ?? a.submitter_id;
    const washer = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [washerId]);
    if (!washer) throw new HttpError(404, 'Washer not found');

    const txData: CreateData = {
      washer_id: washerId,
      category: a.category.toLowerCase(),
      expected_price: a.expected_price,
      cash_paid,
      mpesa_paid,
      mpesa_transaction_id: null,
      mpesa_sender_name: null,
      manual_tip: 0,
      tip_method: 'cash',
      misc_amount: 0,
      misc_description: null,
      has_car_wash: a.category.toUpperCase() === 'CAR',
      has_vacuum: false,
      has_engine_wash: false,
      plate_number: a.plate_number,
      custom_category: null,
      carpet_metadata: null,
    };
    await createTransactionCore(txData, actor);

    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const txId = (
        await client.query(
          `SELECT id FROM transactions WHERE plate_number = $1 AND category = $2
           AND timestamp > now() - interval '2 minutes' ORDER BY id DESC LIMIT 1`,
          [a.plate_number, a.category.toUpperCase()],
        )
      ).rows[0]?.id;
      await client.query(
        `UPDATE vehicle_arrivals SET status='settled', settled_at=$1, cash_paid=$2, mpesa_paid=$3,
           transaction_id=$4, washer_id=COALESCE(washer_id,$5) WHERE id=$6`,
        [now, cash_paid, mpesa_paid, txId ?? null, washerId, id],
      );
      // If the 24h window already passed and an auto shortfall debt exists, the
      // payment deposits against it (full deposit clears it; partial leaves the rest).
      if (a.debt_id) {
        await client.query(
          `UPDATE debts SET paid = GREATEST(paid, LEAST($1::float8, $2::float8)), paid_date = $3 WHERE id = $4`,
          [a.expected_price, cash_paid + mpesa_paid, now, a.debt_id],
        );
      }
      await client.query('COMMIT');
      const updated = await queryOne<ArrivalRow>('SELECT * FROM vehicle_arrivals WHERE id = $1', [id]);
      res.json(serializeArrival(updated!));
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }),
);

// DELETE /vehicles/:id  (remove a mistaken arrival; with its auto debt if any)
router.delete(
  '/:id',
  wrap(async (req: AuthRequest, res) => {
    const user = await getCurrentUser(req);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Arrival not found');
    const a = await queryOne<ArrivalRow>('SELECT * FROM vehicle_arrivals WHERE id = $1', [id]);
    if (!a) throw new HttpError(404, 'Arrival not found');
    if (a.status === 'settled') throw new HttpError(400, 'Settled arrivals stay on record');
    if (user.role.toUpperCase() === 'EMPLOYEE' && a.submitter_id !== user.id) {
      throw new HttpError(403, 'Not your arrival');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (a.debt_id) {
        const debt = await client.query('SELECT * FROM debts WHERE id = $1', [a.debt_id]);
        if (debt.rows.length) {
          await client.query('DELETE FROM debts WHERE id = $1', [a.debt_id]);
        }
      }
      await client.query('DELETE FROM vehicle_arrivals WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.json({ message: 'Arrival deleted' });
  }),
);

export default router;