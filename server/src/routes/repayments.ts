import { Router } from 'express';
import { pool, queryOne } from '../db';
import { HttpError, getCurrentWeekId, validateDay, wrap } from '../utils';
import { asFloat, asInt } from '../finance';
import { requireRole, getCurrentUser } from '../auth';
import { ROLES } from '../types';
import type { AuthRequest } from '../auth';
import type { UserRow, RepaymentRow, DebtRow } from '../types';
import { serializeRepayment } from '../serialize';

const router = Router();
const M = ROLES.slice(0, 2); // ADMIN, MANAGER

// GET /repayments
router.get(
  '/',
  wrap(async (req: AuthRequest, res) => {
    validateDay((req.query.day as string) ?? null);
    const day = req.query.day as string | undefined;
    let week_id = req.query.week_id as string | undefined;
    const user = await getCurrentUser(req);

    let conds: string[] = [];
    let params: any[] = [];
    if (day) {
      params.push(day);
      conds.push(`date(repayments.timestamp) = $${params.length}::date`);
    } else {
      if (!week_id) week_id = getCurrentWeekId();
      params.push(week_id);
      conds.push(`repayments.week_id = $${params.length}`);
    }
    if (user.role.toUpperCase() === 'EMPLOYEE') {
      params.push(user.id);
      conds.push(`repayments.employee_id = $${params.length}`);
    }

    const rows = (
      await pool.query(
        `SELECT repayments.id, repayments.timestamp, repayments.employee_id, repayments.amount, repayments.week_id,
                users.full_name AS employee_name, users.abbreviation
         FROM repayments JOIN users ON users.id = repayments.employee_id
         WHERE ${conds.join(' AND ')}
         ORDER BY repayments.timestamp DESC`,
        params,
      )
    ).rows as (RepaymentRow & { employee_name: string; abbreviation: string })[];
    res.json(rows.map(serializeRepayment));
  }),
);

// POST /repayments
router.post(
  '/',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const body = req.body || {};
    const employee_id = asInt(body.employee_id, 'employee_id');
    const amount = asFloat(body.amount, 'amount');
    if (amount < 0) throw new HttpError(422, 'amount must be >= 0');

    const employee = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [employee_id]);
    if (!employee) throw new HttpError(404, 'Employee not found');

    const week_id = getCurrentWeekId();
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = (
        await client.query(
          `INSERT INTO repayments (timestamp, employee_id, amount, week_id) VALUES ($1,$2,$3,$4) RETURNING *`,
          [now, employee_id, amount, week_id],
        )
      ).rows[0] as RepaymentRow;

      // Update debt balance (clamped so it can never go negative)
      await client.query(
        'UPDATE users SET debt_balance = GREATEST(0, debt_balance - $1) WHERE id = $2',
        [amount, employee_id],
      );

      // Reconcile against outstanding debts (oldest first)
      const openDebts = (
        await client.query('SELECT * FROM debts WHERE employee_id = $1 ORDER BY date ASC', [employee_id])
      ).rows as DebtRow[];
      let remaining = amount;
      const paidDate = new Date().toISOString().replace('T', ' ').replace('Z', '');
      for (const debt of openDebts) {
        if (remaining <= 0) break;
        const outstanding = debt.amount - debt.paid;
        if (outstanding <= 0) continue;
        const applied = Math.min(remaining, outstanding);
        await client.query('UPDATE debts SET paid = paid + $1, paid_date = $2 WHERE id = $3', [
          applied,
          paidDate,
          debt.id,
        ]);
        remaining -= applied;
      }

      await client.query('COMMIT');
      res.json(serializeRepayment(row));
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }),
);

export default router;