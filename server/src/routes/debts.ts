import { Router } from 'express';
import { pool, queryOne } from '../db';
import { HttpError, wrap } from '../utils';
import { asFloat, asOptStr, asOptFloat, money } from '../finance';
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

// POST /debts  - record a debt for an employee (deducted from Sunday wages) or
// an "other" (specified) debtor that is tracked until cleared.
router.post(
  '/',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const body = req.body || {};
    let employee_id: number | null = null;
    if (body.employee_id !== undefined && body.employee_id !== null && body.employee_id !== '') {
      employee_id = Number(body.employee_id);
      if (!Number.isInteger(employee_id)) throw new HttpError(422, 'employee_id must be an integer');
      const emp = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [employee_id]);
      if (!emp) throw new HttpError(404, 'Employee not found');
    }
    const other_name = asOptStr(body.other_name);
    if (employee_id === null && (!other_name || !other_name.trim())) {
      throw new HttpError(422, 'choose an employee or enter a debtor name');
    }
    const amount = money(asFloat(body.amount, 'amount'));
    if (amount < 0) throw new HttpError(422, 'amount must be >= 0');
    const paid = money(asOptFloat(body.paid, 'paid') ?? 0);
    if (paid < 0) throw new HttpError(422, 'paid must be >= 0');
    const service = asOptStr(body.service);
    const notes = asOptStr(body.notes);
    const paidDateStr = asOptStr(body.paid_date);

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
          `INSERT INTO debts (employee_id, other_name, amount, service, date, paid, paid_date, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [employee_id, other_name, amount, service, now, paid, paidDate, notes],
        )
      ).rows[0] as DebtRow;
      if (employee_id !== null) {
        await client.query('UPDATE users SET debt_balance = debt_balance + $1 WHERE id = $2', [
          amount - paid,
          employee_id,
        ]);
      }
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

// PUT /debts/:id - correct anything, including auto-calculated shortfalls:
// change the amount, and/or mark it paid for the full amount or partially
// (the employee's balance updates by the difference). Employees may fix debts
// they own; admin/manager may fix any.
router.put(
  '/:id',
  wrap(async (req: AuthRequest, res) => {
    const user = await getCurrentUser(req);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Debt not found');
    const debt = await queryOne<DebtRow>('SELECT * FROM debts WHERE id = $1', [id]);
    if (!debt) throw new HttpError(404, 'Debt not found');
    if (user.role.toUpperCase() === 'EMPLOYEE' && debt.employee_id !== user.id) {
      throw new HttpError(403, 'Not your debt');
    }

    const body = req.body || {};
    const amount = body.amount !== undefined ? money(asFloat(body.amount, 'amount')) : money(debt.amount);
    if (amount < 0) throw new HttpError(422, 'amount must be >= 0');
    const paid = body.paid !== undefined ? money(asOptFloat(body.paid, 'paid')) : money(debt.paid);
    if (paid < 0) throw new HttpError(422, 'paid must be >= 0');
    if (paid > amount) throw new HttpError(422, 'paid cannot exceed amount');
    const service = asOptStr(body.service) ?? debt.service;
    const notes = asOptStr(body.notes) ?? debt.notes;
    const other_name = asOptStr(body.other_name) ?? debt.other_name;
    const paidDateStr = asOptStr(body.paid_date);

    let paidDate = debt.paid_date
      ? new Date(debt.paid_date).toISOString().replace('T', ' ').replace('Z', '')
      : null;
    if (paidDateStr !== undefined) {
      if (!paidDateStr) paidDate = null;
      else {
        const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?))?/.exec(paidDateStr);
        if (m) paidDate = `${m[1]} ${m[2] ? m[2].replace(/\.\d+$/, '') : '00:00:00'}`;
      }
    }
    if (paid > 0 && !paidDate) {
      paidDate = new Date().toISOString().replace('T', ' ').replace('Z', '');
    }

    const delta = (amount - paid) - (debt.amount - debt.paid);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE debts SET amount = $1, paid = $2, paid_date = $3, service = $4, notes = $5, other_name = $6 WHERE id = $7',
        [amount, paid, paidDate, service, notes, other_name, id],
      );
      if (debt.employee_id !== null) {
        await client.query('UPDATE users SET debt_balance = GREATEST(0, debt_balance + $1) WHERE id = $2', [
          delta,
          debt.employee_id,
        ]);
      }
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

// DELETE /debts/:id - remove a mistaken auto shortfall (admin/manager only)
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
      if (debt.employee_id !== null) {
        await client.query('UPDATE users SET debt_balance = GREATEST(0, debt_balance - $1) WHERE id = $2', [
          debt.amount - debt.paid,
          debt.employee_id,
        ]);
      }
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