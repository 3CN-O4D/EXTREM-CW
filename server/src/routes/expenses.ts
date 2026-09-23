import { Router } from 'express';
import { pool } from '../db';
import { HttpError, getCurrentWeekId, validateDay, wrap } from '../utils';
import { asFloat, asOptStr } from '../finance';
import { requireRole } from '../auth';
import { ROLES } from '../types';
import type { AuthRequest } from '../auth';
import type { ExpenseRow } from '../types';
import { serializeExpense } from '../serialize';

const router = Router();
const M = ROLES.slice(0, 2); // ADMIN, MANAGER

// POST /expenses
router.post(
  '/',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const body = req.body || {};
    const description = asOptStr(body.description);
    if (description === null) throw new HttpError(422, 'description is required');
    const amount = asFloat(body.amount, 'amount');
    if (amount < 0) throw new HttpError(422, 'amount must be >= 0');
    const category = asOptStr(body.category) ?? 'Other';

    const week_id = getCurrentWeekId();
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const row = (
      await pool.query(
        `INSERT INTO expenses (timestamp, description, amount, category, week_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [now, description, amount, category, week_id],
      )
    ).rows[0] as ExpenseRow;
    res.status(200).json(serializeExpense(row));
  }),
);

// GET /expenses
router.get(
  '/',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    validateDay((req.query.day as string) ?? null);
    const day = req.query.day as string | undefined;
    let week_id = req.query.week_id as string | undefined;

    let conds: string[] = [];
    let params: any[] = [];
    if (day) {
      params.push(day);
      conds.push(`date(timestamp) = $${params.length}::date`);
    } else {
      if (!week_id) week_id = getCurrentWeekId();
      params.push(week_id);
      conds.push(`week_id = $${params.length}`);
    }
    const rows = (
      await pool.query(`SELECT * FROM expenses WHERE ${conds.join(' AND ')} ORDER BY timestamp DESC`, params)
    ).rows as ExpenseRow[];
    res.json(rows.map(serializeExpense));
  }),
);

// DELETE /expenses/:id
router.delete(
  '/:id',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Expense not found');
    const del = await pool.query('DELETE FROM expenses WHERE id = $1', [id]);
    if ((del.rowCount ?? 0) === 0) throw new HttpError(404, 'Expense not found');
    res.json({ message: 'Expense deleted' });
  }),
);

export default router;