import { Router } from 'express';
import { pool } from '../db';
import { HttpError, getCurrentWeekId, wrap } from '../utils';
import { asFloat, asOptStr } from '../finance';
import { requireRole } from '../auth';
import { ROLES } from '../types';

const router = Router();
const M = ROLES.slice(0, 2); // ADMIN, MANAGER

// POST /tips
router.post(
  '/',
  wrap(async (req, res) => {
    await requireRole(req, M);
    const body = req.body || {};
    const employee_id = Number(body.employee_id);
    if (!Number.isInteger(employee_id)) throw new HttpError(422, 'employee_id must be an integer');
    const amount = asFloat(body.amount, 'amount');
    if (amount < 0) throw new HttpError(422, 'amount must be >= 0');
    const method = (asOptStr(body.method) ?? '').toLowerCase();
    if (method !== 'cash' && method !== 'wages') {
      throw new HttpError(422, 'value is not a valid enumeration member for method');
    }

    const emp = (
      await pool.query('SELECT id, full_name, payable_balance FROM users WHERE id = $1', [employee_id])
    ).rows[0];
    if (!emp) throw new HttpError(404, 'Employee not found');
    if (!emp.full_name) throw new HttpError(404, 'Employee not found');

    const week_id = getCurrentWeekId();
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO tips (timestamp, employee_id, amount, method, week_id, notes)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [now, employee_id, amount, method.toUpperCase(), week_id, 'Tip logged via /tips'],
      );

      if (method === 'wages') {
        // WAGES = add to wage balance
        await client.query('UPDATE users SET payable_balance = payable_balance + $1 WHERE id = $2', [
          amount,
          employee_id,
        ]);
      } else {
        // CASH = record a Chai expense
        await client.query(
          `INSERT INTO expenses (timestamp, description, amount, category, week_id)
           VALUES ($1,$2,$3,$4,$5)`,
          [now, `Chai - ${emp.full_name}`, amount, 'Chai', week_id],
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ message: 'Tip logged successfully', method, employee: emp.full_name });
  }),
);

export default router;