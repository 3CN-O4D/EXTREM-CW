import { Router } from 'express';
import { pool, queryOne } from '../db';
import { HttpError, getCurrentWeekId, validateDay, wrap } from '../utils';
import { asFloat, asOptStr, money } from '../finance';
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
    const amount = money(asFloat(body.amount, 'amount'));
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

// PUT /expenses/:id
router.put(
  '/:id',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Expense not found');

    const body = req.body || {};
    const sets: string[] = [];
    const params: any[] = [];
    if (body.description !== undefined) {
      const d = asOptStr(body.description);
      if (d === null) throw new HttpError(422, 'description is required');
      params.push(d);
      sets.push(`description = $${params.length}`);
    }
    if (body.amount !== undefined) {
      const a = money(asFloat(body.amount, 'amount'));
      if (a < 0) throw new HttpError(422, 'amount must be >= 0');
      params.push(a);
      sets.push(`amount = $${params.length}`);
    }
    if (body.category !== undefined) {
      const c = asOptStr(body.category) ?? 'Other';
      params.push(c);
      sets.push(`category = $${params.length}`);
    }
    if (!sets.length) {
      const row = await queryOne<ExpenseRow>('SELECT * FROM expenses WHERE id = $1', [id]);
      if (!row) throw new HttpError(404, 'Expense not found');
      return res.json(serializeExpense(row));
    }
    params.push(id);
    const rows = (
      await pool.query(`UPDATE expenses SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params)
    ).rows as ExpenseRow[];
    if (!rows.length) throw new HttpError(404, 'Expense not found');
    res.json(serializeExpense(rows[0]));
  }),
);

export default router;