import { Router } from 'express';
import { pool, queryOne } from '../db';
import { HttpError, wrap } from '../utils';
import { asFloat, asOptStr, asOptFloat } from '../finance';
import { requireRole, getCurrentUser } from '../auth';
import { ROLES } from '../types';
import type { AuthRequest } from '../auth';
import type { DebtRow, UserRow } from '../types';
import { serializeDebt } from '../serialize';

const router = Router();
const M = ROLES.slice(0, 2); // ADMIN, MANAGER

// GET /debts
router.get(
  '/',
  wrap(async (req: AuthRequest, res) => {
    const user = await getCurrentUser(req);
    const conds: string[] = [];
    const params: any[] = [];
    const employee_id = req.query.employee_id as string | undefined;
    if (employee_id) {
      const id = Number(employee_id);
      if (!Number.isInteger(id)) throw new HttpError(422, 'employee_id must be an integer');
      params.push(id);
      conds.push(`employee_id = $${params.length}`);
    }
    if (user.role.toUpperCase() === 'EMPLOYEE') {
      params.push(user.id);
      conds.push(`employee_id = $${params.length}`);
    }
    const rows = (
      await pool.query(
        `SELECT * FROM debts ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''} ORDER BY date DESC`,
        params,
      )
    ).rows as DebtRow[];
    res.json(rows.map(serializeDebt));
  }),
);

// POST /debts
router.post(
  '/',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const body = req.body || {};
    const employee_id = Number(body.employee_id);
    if (!Number.isInteger(employee_id)) throw new HttpError(422, 'employee_id must be an integer');
    const amount = asFloat(body.amount, 'amount');
    if (amount < 0) throw new HttpError(422, 'amount must be >= 0');
    const paid = asOptFloat(body.paid, 'paid') ?? 0;
    if (paid < 0) throw new HttpError(422, 'paid must be >= 0');
    const service = asOptStr(body.service);
    const notes = asOptStr(body.notes);
    const paidDateStr = asOptStr(body.paid_date);

    const emp = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [employee_id]);
    if (!emp) throw new HttpError(404, 'Employee not found');

    // datetime.fromisoformat tolerant parse (accepts YYYY-MM-DD or full ISO)
    let paidDate: string | null = null;
    if (paidDateStr) {
      const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?))?/.exec(paidDateStr);
      if (m) {
        const d = m[1];
        const t = m[2] ? m[2].replace(/\.\d+$/, '') : '00:00:00';
        paidDate = `${d} ${t}`;
      }
    }

    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = (
        await client.query(
          `INSERT INTO debts (employee_id, amount, service, date, paid, paid_date, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [employee_id, amount, service, now, paid, paidDate, notes],
        )
      ).rows[0] as DebtRow;
      await client.query('UPDATE users SET debt_balance = debt_balance + $1 WHERE id = $2', [
        amount - paid,
        employee_id,
      ]);
      await client.query('COMMIT');
      res.json(serializeDebt(row));
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }),
);

// PUT /debts/:id
router.put(
  '/:id',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Debt not found');
    const debt = await queryOne<DebtRow>('SELECT * FROM debts WHERE id = $1', [id]);
    if (!debt) throw new HttpError(404, 'Debt not found');

    const body = req.body || {};
    const paid = asFloat(body.paid, 'paid');
    if (paid < 0) throw new HttpError(422, 'paid must be >= 0');
    const paidDateStr = asOptStr(body.paid_date);

    let paidDate: string | null = debt.paid_date
      ? debt.paid_date.toISOString().replace('T', ' ').replace('Z', '')
      : null;
    if (paidDateStr) {
      const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?))?/.exec(paidDateStr);
      if (m) paidDate = `${m[1]} ${m[2] ? m[2].replace(/\.\d+$/, '') : '00:00:00'}`;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE debts SET paid = $1, paid_date = $2 WHERE id = $3', [paid, paidDate, id]);
      await client.query(
        'UPDATE users SET debt_balance = debt_balance - $1 + $2 WHERE id = $3',
        [debt.paid, paid, debt.employee_id],
      );
      await client.query('COMMIT');
      const updated = await queryOne<DebtRow>('SELECT * FROM debts WHERE id = $1', [id]);
      res.json(serializeDebt(updated!));
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }),
);

// DELETE /debts/:id
router.delete(
  '/:id',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Debt not found');
    const debt = await queryOne<DebtRow>('SELECT * FROM debts WHERE id = $1', [id]);
    if (!debt) throw new HttpError(404, 'Debt not found');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE users SET debt_balance = debt_balance - $1 WHERE id = $2', [
        debt.amount - debt.paid,
        debt.employee_id,
      ]);
      await client.query('DELETE FROM debts WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.json({ message: 'Debt deleted' });
  }),
);

export default router;