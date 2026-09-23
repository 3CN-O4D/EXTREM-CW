import { Router } from 'express';
import { pool } from '../db';
import { HttpError, getCurrentWeekId, validateDay, wrap, weekdayName, weekdayNameFromDate, toUtcTimestamp } from '../utils';
import { requireRole, getCurrentUser } from '../auth';
import { ROLES } from '../types';
import type { AuthRequest } from '../auth';
import type { UserRow } from '../types';
import { iso } from '../serialize';

const router = Router();
const M = ROLES.slice(0, 2); // ADMIN, MANAGER

interface StatsScope {
  day?: string;
  week_id?: string;
}

function empScopeParams(empId: number, scope: StatsScope): { text: string; params: any[] } {
  if (scope.day) return { text: 'WHERE washer_id = $1 AND date(timestamp) = $2::date', params: [empId, scope.day] };
  const week_id = scope.week_id || getCurrentWeekId();
  return { text: 'WHERE washer_id = $1 AND week_id = $2', params: [empId, week_id] };
}

async function collectEmployeeStats(emp: UserRow, scope: StatsScope): Promise<Record<string, unknown>> {
  const q = empScopeParams(emp.id, scope);

  const [rev, wages, shortfall, jobs, cats, daily, debtSrc, misc, miscItems, received, released] = await Promise.all([
    pool.query(`SELECT COALESCE(SUM(net_business_remittance),0) AS v FROM transactions ${q.text}`, [...q.params]),
    pool.query(`SELECT COALESCE(SUM(final_payout),0) AS v FROM transactions ${q.text} AND final_payout > 0`, [...q.params]),
    pool.query(`SELECT COALESCE(SUM(shortfall),0) AS v FROM transactions ${q.text}`, [...q.params]),
    pool.query(`SELECT COUNT(id) AS v FROM transactions ${q.text}`, [...q.params]),
    pool.query(`SELECT category, COUNT(id) AS c FROM transactions ${q.text} GROUP BY category`, [...q.params]),
    pool.query(`SELECT date(timestamp) AS day, SUM(final_payout) AS wages FROM transactions ${q.text} AND final_payout > 0 GROUP BY date(timestamp)`, [...q.params]),
    pool.query(`SELECT id, timestamp, category, custom_category, expected_price, shortfall, plate_number FROM transactions ${q.text} AND shortfall > 0`, [...q.params]),
    pool.query(`SELECT COALESCE(SUM(misc_amount),0) AS v FROM transactions ${q.text}`, [...q.params]),
    pool.query(`SELECT id, timestamp, misc_amount AS amount, misc_description AS description, category, custom_category, plate_number FROM transactions ${q.text} AND misc_amount > 0`, [...q.params]),
    pool.query("SELECT COUNT(id) AS c FROM carpets WHERE receiver_id = $1 AND status = 'received'", [emp.id]),
    pool.query("SELECT COUNT(id) AS c FROM carpets WHERE receiver_id = $1 AND status = 'released'", [emp.id]),
  ]);

  const empCounts: Record<string, number> = {};
  for (const r of cats.rows) empCounts[String(r.category).toLowerCase()] = Number(r.c);

  const wageBreakdown = daily.rows.map((d) => ({
    day: toUtcTimestamp(d.day).slice(0, 10),
    day_of_week: weekdayNameFromDate(d.day),
    wages: Number(d.wages),
  }));

  const debtSources = debtSrc.rows.map((t) => ({
    id: t.id,
    timestamp: iso(new Date(t.timestamp)),
    category: String(t.category).toLowerCase(),
    custom_category: t.custom_category,
    expected_price: t.expected_price,
    shortfall: t.shortfall,
    plate_number: t.plate_number,
  }));

  const miscItemsOut = miscItems.rows.map((t) => ({
    id: t.id,
    timestamp: iso(new Date(t.timestamp)),
    amount: t.amount,
    description: t.description,
    category: String(t.category).toLowerCase(),
    custom_category: t.custom_category,
    plate_number: t.plate_number,
  }));

  return {
    id: emp.id,
    name: emp.full_name,
    abbreviation: emp.abbreviation,
    jobs_count: Number(jobs.rows[0].v),
    revenue_generated: Number(rev.rows[0].v),
    wages_earned: Number(wages.rows[0].v),
    shortfall_total: Number(shortfall.rows[0].v),
    wage_breakdown: wageBreakdown,
    current_debt: emp.debt_balance,
    payable_balance: emp.payable_balance,
    service_counts: empCounts,
    debt_sources: debtSources,
    misc_earned: Number(misc.rows[0].v),
    misc_items: miscItemsOut,
    carpets_received: Number(received.rows[0].c),
    carpets_released: Number(released.rows[0].c),
  };
}

// GET /stats/summary
router.get(
  '/summary',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    validateDay((req.query.day as string) ?? null);
    const day = req.query.day as string | undefined;
    let week_id = req.query.week_id as string | undefined;

    const txParams: any[] = [];
    const expParams: any[] = [];
    let txConds = '';
    let expConds = '';
    if (day) {
      txParams.push(day);
      txConds = `WHERE date(timestamp) = $${txParams.length}::date`;
      expParams.push(day);
      expConds = `WHERE date(timestamp) = $${expParams.length}::date`;
    } else {
      if (!week_id) week_id = getCurrentWeekId();
      txParams.push(week_id);
      txConds = `WHERE week_id = $${txParams.length}`;
      expParams.push(week_id);
      expConds = `WHERE week_id = $${expParams.length}`;
    }

    const [totalCash, expenses, labor, revenue, miscTotal, miscRows, catRows, totalDebt, empLabor] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(total_paid),0) AS v FROM transactions ${txConds}`, txParams),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS v FROM expenses ${expConds}`, expParams),
      pool.query(`SELECT COALESCE(SUM(final_payout),0) AS v FROM transactions ${txConds} AND final_payout > 0`, txParams),
      pool.query(`SELECT COALESCE(SUM(net_business_remittance),0) AS v FROM transactions ${txConds}`, txParams),
      pool.query(`SELECT COALESCE(SUM(misc_amount),0) AS v FROM transactions ${txConds}`, txParams),
      pool.query(
        `SELECT id, timestamp, misc_amount AS amount, misc_description AS description, category, custom_category, plate_number, washer_id
         FROM transactions ${txConds} AND misc_amount > 0 ORDER BY timestamp DESC`,
        txParams,
      ),
      pool.query(`SELECT category, COUNT(id) AS c FROM transactions ${txConds} GROUP BY category`, txParams),
      pool.query(`SELECT COALESCE(SUM(debt_balance),0) AS v FROM users`),
      pool.query(
        `SELECT users.full_name, users.abbreviation, SUM(transactions.final_payout) AS wages
         FROM users JOIN transactions ON users.id = transactions.washer_id
         WHERE transactions.final_payout > 0 AND ${day ? 'date(transactions.timestamp) = $1::date' : 'transactions.week_id = $1'}
         GROUP BY users.id`,
        day ? [day] : [week_id],
      ),
    ]);

    // Resolve washer names for misc_items
    const washerIds = [...new Set(miscRows.rows.map((r: any) => r.washer_id).filter(Boolean))];
    const nameOf: Record<number, string> = {};
    if (washerIds.length) {
      const users = (
        await pool.query(`SELECT id, full_name, abbreviation FROM users WHERE id = ANY($1::int[])`, [washerIds])
      ).rows;
      for (const u of users) nameOf[u.id] = `${u.full_name} (${u.abbreviation})`;
    }

    const categoryCounts: Record<string, number> = {};
    for (const r of catRows.rows) categoryCounts[String(r.category).toLowerCase()] = Number(r.c);

    const miscItems = miscRows.rows.map((t: any) => ({
      id: t.id,
      timestamp: iso(new Date(t.timestamp)),
      amount: t.amount,
      description: t.description,
      category: String(t.category).toLowerCase(),
      custom_category: t.custom_category,
      plate_number: t.plate_number,
      washer: t.washer_id ? nameOf[t.washer_id] ?? null : null,
    }));

    const totalCashV = Number(totalCash.rows[0].v);
    const expensesV = Number(expenses.rows[0].v);
    const laborV = Number(labor.rows[0].v);
    res.json({
      week_id,
      day: day ?? null,
      day_of_week: day ? weekdayName(day) : null,
      total_cash_received: totalCashV,
      total_expenses: expensesV,
      balance: totalCashV - expensesV,
      total_labor_expense: laborV,
      total_revenue: Number(revenue.rows[0].v),
      misc_total: Number(miscTotal.rows[0].v),
      misc_items: miscItems,
      labor_breakdown: empLabor.rows.map((e: any) => ({
        name: e.full_name,
        abbreviation: e.abbreviation,
        wages: Number(e.wages),
      })),
      category_counts: categoryCounts,
      total_debts: Number(totalDebt.rows[0].v),
    });
  }),
);

// GET /stats/employees
router.get(
  '/employees',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    validateDay((req.query.day as string) ?? null);
    const scope: StatsScope = {
      day: req.query.day as string | undefined,
      week_id: req.query.week_id as string | undefined,
    };
    const employees = (
      await pool.query("SELECT * FROM users WHERE role = 'EMPLOYEE' ORDER BY id")
    ).rows as UserRow[];
    const out = [];
    for (const emp of employees) out.push(await collectEmployeeStats(emp, scope));
    res.json(out);
  }),
);

// GET /stats/employees/:id
router.get(
  '/employees/:id',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    validateDay((req.query.day as string) ?? null);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Employee not found');
    const emp = (
      await pool.query('SELECT * FROM users WHERE id = $1', [id])
    ).rows[0] as UserRow | undefined;
    if (!emp) throw new HttpError(404, 'Employee not found');
    const scope: StatsScope = {
      day: req.query.day as string | undefined,
      week_id: req.query.week_id as string | undefined,
    };
    res.json(await collectEmployeeStats(emp, scope));
  }),
);

// GET /stats/me
router.get(
  '/me',
  wrap(async (req: AuthRequest, res) => {
    const user = await getCurrentUser(req);
    validateDay((req.query.day as string) ?? null);
    const scope: StatsScope = {
      day: req.query.day as string | undefined,
      week_id: req.query.week_id as string | undefined,
    };
    res.json(await collectEmployeeStats(user, scope));
  }),
);

export default router;