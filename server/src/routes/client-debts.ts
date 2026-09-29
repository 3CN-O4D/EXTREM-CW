import { Router } from 'express';
import { pool, queryOne } from '../db';
import { HttpError, toUtcTimestamp, wrap } from '../utils';
import { asOptFloat, asOptStr } from '../finance';
import { requireRole } from '../auth';
import { ROLES } from '../types';
import type { AuthRequest } from '../auth';
import type { ClientDebtRow } from '../types';
import { serializeClientDebt } from '../serialize';

const router = Router();
const M = ROLES.slice(0, 2); // ADMIN, MANAGER

// GET /client-debts
router.get(
  '/',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const conds: string[] = [];
    const params: any[] = [];
    const client_name = req.query.client_name as string | undefined;
    if (client_name) {
      params.push(`%${client_name}%`);
      conds.push(`client_name ILIKE $${params.length}`);
    }
    const rows = (
      await pool.query(
        `SELECT * FROM client_debts ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''} ORDER BY date DESC`,
        params,
      )
    ).rows as ClientDebtRow[];
    res.json(rows.map(serializeClientDebt));
  }),
);

// POST /client-debts
router.post(
  '/',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const body = req.body || {};
    const client_name = asOptStr(body.client_name);
    if (!client_name) throw new HttpError(422, 'client_name is required');
    const amount = asOptFloat(body.amount, 'amount');
    if (amount === undefined || amount < 0) {
      throw new HttpError(422, amount === undefined ? 'amount must be a number' : 'amount must be >= 0');
    }
    const paid = asOptFloat(body.paid, 'paid') ?? 0;
    if (paid < 0) throw new HttpError(422, 'paid must be >= 0');

    const now = toUtcTimestamp(new Date());
    const row = (
      await pool.query(
        `INSERT INTO client_debts (client_name, customer_phone, description, amount, paid, date, paid_date, notes, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          client_name,
          asOptStr(body.customer_phone),
          asOptStr(body.description),
          amount,
          paid,
          now,
          undefined,
          asOptStr(body.notes),
          now,
        ],
      )
    ).rows[0] as ClientDebtRow;
    res.json(serializeClientDebt(row));
  }),
);

// PUT /client-debts/:id  (record how much has been paid / cleared)
router.put(
  '/:id',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Client debt not found');
    const debt = await queryOne<ClientDebtRow>('SELECT * FROM client_debts WHERE id = $1', [id]);
    if (!debt) throw new HttpError(404, 'Client debt not found');

    const body = req.body || {};
    const paid = asOptFloat(body.paid, 'paid');
    const paidDateStr = asOptStr(body.paid_date);

    const newPaid = paid ?? debt.paid;
    if (newPaid < 0) throw new HttpError(422, 'paid must be >= 0');

    let paidDate: string | null | undefined = undefined;
    if (paidDateStr !== null && paidDateStr !== undefined) {
      const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?))?/.exec(paidDateStr);
      paidDate = m ? `${m[1]} ${m[2] ? m[2].replace(/\.\d+$/, '') : '00:00:00'}` : paidDateStr;
    }

    const sets: string[] = [];
    const params: any[] = [];
    params.push(newPaid);
    sets.push(`paid = $${params.length}`);
    if (paidDate !== undefined) {
      params.push(paidDate === null ? null : paidDate);
      sets.push(`paid_date = $${params.length}`);
    }
    params.push(id);
    const row = (
      await pool.query(`UPDATE client_debts SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params)
    ).rows[0] as ClientDebtRow;
    res.json(serializeClientDebt(row));
  }),
);

// DELETE /client-debts/:id
router.delete(
  '/:id',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Client debt not found');
    await pool.query('DELETE FROM client_debts WHERE id = $1', [id]);
    res.json({ message: 'Client debt deleted' });
  }),
);

export default router;