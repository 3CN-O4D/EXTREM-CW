import { Router } from 'express';
import { pool, queryOne } from '../db';
import { HttpError, getCurrentWeekId, isoWeekRange, WEEK_ID_RE, wrap } from '../utils';
import { requireRole } from '../auth';
import { ROLES } from '../types';
import type { AuthRequest } from '../auth';
import type { WeeklyLogRow, UserRow, DebtRow } from '../types';
import { serializeWeeklyLog } from '../serialize';

const router = Router();
const M = ROLES.slice(0, 2); // ADMIN, MANAGER

// GET /settlements?week_id=
router.get(
  '/',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    let week_id = req.query.week_id as string | undefined;
    const conds: string[] = [];
    const params: any[] = [];
    if (week_id) {
      if (!WEEK_ID_RE.test(week_id)) throw new HttpError(422, 'week_id must be in YYYY-WW format');
      params.push(week_id);
      conds.push('week_id = $1');
    }
    const rows = (
      await pool.query(
        `SELECT * FROM weekly_logs ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''} ORDER BY week_id DESC`,
        params,
      )
    ).rows as WeeklyLogRow[];
    res.json(rows.map(serializeWeeklyLog));
  }),
);

// POST /settlements  — Sunday-evening payday: settle a week.
// For every employee: that week's wages (commission credits + wages-tips) are
// paid out after covering ALL open employee debts. Any unpaid debt remainder
// carries into the next week. payable_balance is reset to zero (Monday fresh).
router.post(
  '/',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const body = req.body || {};
    let weekId = (body.week_id as string | undefined) || getCurrentWeekId();
    if (!WEEK_ID_RE.test(weekId)) throw new HttpError(422, 'week_id must be in YYYY-WW format');

    const existing = await queryOne<WeeklyLogRow>('SELECT * FROM weekly_logs WHERE week_id = $1', [weekId]);
    if (existing) throw new HttpError(409, `Week ${weekId} already settled`);

    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const { start, end } = isoWeekRange(weekId);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const employees = (
        await client.query("SELECT * FROM users WHERE role = 'EMPLOYEE' ORDER BY id")
      ).rows as UserRow[];

      const perEmployee: Record<string, unknown>[] = [];
      let cashPaidTotal = 0;
      let debtCarriedTotal = 0;
      let laborFromTxs = 0;

      for (const emp of employees) {
        const wagesRes = await client.query(
          'SELECT COALESCE(SUM(GREATEST(final_payout, 0)), 0) AS v FROM transactions WHERE week_id = $1 AND washer_id = $2',
          [weekId, emp.id],
        );
        const wages = Number(wagesRes.rows[0].v);
        const tipsRes = await client.query(
          "SELECT COALESCE(SUM(amount), 0) AS v FROM tips WHERE week_id = $1 AND employee_id = $2 AND method = 'WAGES'",
          [weekId, emp.id],
        );
        const tipsWages = Number(tipsRes.rows[0].v);
        const wagesTotal = wages + tipsWages;
        laborFromTxs += wages;

        const openRes = await client.query(
          'SELECT id, amount, paid FROM debts WHERE employee_id = $1 ORDER BY date ASC, id ASC',
          [emp.id],
        );
        const open = openRes.rows as Pick<DebtRow, 'id' | 'amount' | 'paid'>[];
        const owed = open.reduce((s, d) => s + (d.amount - d.paid), 0);

        const covered = Math.min(wagesTotal, owed);
        const carry = owed - covered;
        const cashPay = wagesTotal - covered;

        if (covered > 0) {
          await client.query(
            `INSERT INTO repayments (timestamp, employee_id, amount, week_id) VALUES ($1,$2,$3,$4)`,
            [now, emp.id, covered, weekId],
          );
          let remaining = covered;
          for (const debt of open) {
            if (remaining <= 0) break;
            const outstanding = debt.amount - debt.paid;
            if (outstanding <= 0) continue;
            const applied = Math.min(remaining, outstanding);
            await client.query('UPDATE debts SET paid = paid + $1, paid_date = $2 WHERE id = $3', [
              applied,
              now,
              debt.id,
            ]);
            remaining -= applied;
          }
        }

        await client.query(
          'UPDATE users SET payable_balance = 0, debt_balance = $1 WHERE id = $2',
          [carry, emp.id],
        );

        if (wagesTotal > 0 || owed > 0) {
          cashPaidTotal += cashPay;
          debtCarriedTotal += carry;
          perEmployee.push({
            id: emp.id,
            full_name: emp.full_name,
            abbreviation: emp.abbreviation,
            wages,
            tips_wages: tipsWages,
            debts_covered: covered,
            cash_paid: cashPay,
            carried_forward: carry,
          });
        }
      }

      const rev = await client.query(
        'SELECT COALESCE(SUM(net_business_remittance), 0) AS v FROM transactions WHERE week_id = $1',
        [weekId],
      );
      const exp = await client.query(
        'SELECT COALESCE(SUM(amount), 0) AS v FROM expenses WHERE week_id = $1',
        [weekId],
      );
      const revenue = Number(rev.rows[0].v);
      const expenses = Number(exp.rows[0].v);
      const totalProfit = revenue - expenses - laborFromTxs;

      const dataJson = JSON.stringify({
        employees: perEmployee,
        cash_paid_total: cashPaidTotal,
        debt_carried_total: debtCarriedTotal,
        settled_at: now,
      });

      const row = (
        await client.query(
          `INSERT INTO weekly_logs (week_id, start_date, end_date, total_revenue, total_expenses, total_labor_expense, total_profit, data_json)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [weekId, start, end, revenue, expenses, laborFromTxs, totalProfit, dataJson],
        )
      ).rows[0] as WeeklyLogRow;

      await client.query('COMMIT');

      res.json({
        week_id: weekId,
        cash_paid_total: cashPaidTotal,
        debt_carried_total: debtCarriedTotal,
        total_profit: totalProfit,
        employees: perEmployee,
        weekly_log: serializeWeeklyLog(row),
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }),
);

export default router;