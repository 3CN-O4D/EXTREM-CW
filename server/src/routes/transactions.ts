import { Router } from 'express';
import { pool, queryOne } from '../db';
import { HttpError, getCurrentWeekId, validateDay, wrap } from '../utils';
import { asFloat, asInt, asBool, asOptFloat, asOptInt, asOptStr, requireEnum, calculateTransaction } from '../finance';
import { TransactionSummary, EmployeeFinancials, LedgerRouting } from '../finance';
import { getCurrentUser, requireRole, AuthRequest } from '../auth';
import { SERVICE_CATEGORIES, TIP_METHODS } from '../types';
import type { UserRow, TxRow, ExpenseRow } from '../types';
import { iso, serializeTx } from '../serialize';
import { ROLES } from '../types';

const router = Router();

export interface CarpetMetadataIn {
  characteristics: string;
  receiver_id: number;
  customer_phone: string | null;
}

export interface CreateData {
  washer_id: number;
  category: string;
  expected_price: number;
  cash_paid: number;
  mpesa_paid: number;
  mpesa_transaction_id: string | null;
  mpesa_sender_name: string | null;
  manual_tip: number;
  tip_method: string;
  misc_amount: number;
  misc_description: string | null;
  has_car_wash: boolean;
  has_vacuum: boolean;
  has_engine_wash: boolean;
  plate_number: string | null;
  custom_category: string | null;
  carpet_metadata: CarpetMetadataIn | null;
}

function parseMetadata(v: unknown): CarpetMetadataIn | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) throw new HttpError(422, 'carpet_metadata must be an object');
  const o = v as Record<string, unknown>;
  if (o.characteristics === undefined || o.receiver_id === undefined) {
    throw new HttpError(422, 'carpet_metadata requires characteristics and receiver_id');
  }
  return {
    characteristics: asOptStr(o.characteristics) ?? '',
    receiver_id: asInt(o.receiver_id, 'receiver_id'),
    customer_phone: asOptStr(o.customer_phone),
  };
}

export function parseCreate(body: Record<string, unknown>): CreateData {
  const data: CreateData = {
    washer_id: asInt(body.washer_id, 'washer_id'),
    category: requireEnum(asOptStr(body.category) ?? '', SERVICE_CATEGORIES, 'category'),
    expected_price: asFloat(body.expected_price, 'expected_price'),
    cash_paid: asFloat(body.cash_paid, 'cash_paid'),
    mpesa_paid: asFloat(body.mpesa_paid, 'mpesa_paid'),
    mpesa_transaction_id: asOptStr(body.mpesa_transaction_id),
    mpesa_sender_name: asOptStr(body.mpesa_sender_name),
    manual_tip: asOptFloat(body.manual_tip, 'manual_tip') ?? 0,
    tip_method: requireEnum(asOptStr(body.tip_method) ?? '', TIP_METHODS, 'tip_method'),
    misc_amount: asOptFloat(body.misc_amount, 'misc_amount') ?? 0,
    misc_description: asOptStr(body.misc_description),
    has_car_wash: body.has_car_wash === undefined ? false : asBool(body.has_car_wash, 'has_car_wash'),
    has_vacuum: body.has_vacuum === undefined ? false : asBool(body.has_vacuum, 'has_vacuum'),
    has_engine_wash: body.has_engine_wash === undefined ? false : asBool(body.has_engine_wash, 'has_engine_wash'),
    plate_number: asOptStr(body.plate_number),
    custom_category: asOptStr(body.custom_category),
    carpet_metadata: parseMetadata(body.carpet_metadata),
  };
  for (const k of ['expected_price', 'cash_paid', 'mpesa_paid', 'manual_tip', 'misc_amount']) {
    if ((data as any)[k] < 0) throw new HttpError(422, `${k} must be >= 0`);
  }
  return data;
}

export function validateMisc(data: CreateData): void {
  const extra = Math.max(0.0, data.cash_paid + data.mpesa_paid - data.expected_price);
  const wanted = data.misc_amount;
  if (wanted && wanted > extra) {
    throw new HttpError(
      400,
      `Miscellaneous amount (${wanted}) exceeds overpayment (${extra}). Amount beyond expected must be tip or miscellaneous.`,
    );
  }
  if (wanted && !data.misc_description) {
    throw new HttpError(400, 'Miscellaneous amount requires a description');
  }
}

const TX_FIELDS =
  `id, timestamp, washer_id, category, expected_price, cash_paid, mpesa_paid, mpesa_transaction_id, ` +
  `mpesa_sender_name, manual_tip, tip_method, misc_amount, misc_description, has_car_wash, has_vacuum, ` +
  `has_engine_wash, plate_number, customer_phone, custom_category, carpet_characteristics, receiver_id, ` +
  `total_paid, isolated_tip, net_business_remittance, shortfall, calculated_commission, ` +
  `net_wage_before_tip, final_payout, week_id`;

export interface CreateResult {
  id: number;
  timestamp: string;
  transaction_summary: TransactionSummary;
  employee_financials: EmployeeFinancials;
  ledger_routing: LedgerRouting;
}

// Shared core used by POST /transactions/ and the carpet release flow.
export async function createTransactionCore(data: CreateData, actor: UserRow): Promise<CreateResult> {
  const result = calculateTransaction(data);
  validateMisc(data);

  const washer = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [data.washer_id]);
  if (!washer) throw new HttpError(404, 'Washer not found');

  const md = data.carpet_metadata;
  const week_id = getCurrentWeekId();
  const now = new Date();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const insert = await client.query(
      `INSERT INTO transactions (
        timestamp, washer_id, category, expected_price, cash_paid, mpesa_paid, mpesa_transaction_id,
        mpesa_sender_name, manual_tip, tip_method, misc_amount, misc_description, has_car_wash, has_vacuum,
        has_engine_wash, plate_number, customer_phone, custom_category, carpet_characteristics, receiver_id,
        total_paid, isolated_tip, net_business_remittance, shortfall, calculated_commission,
        net_wage_before_tip, final_payout, week_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
      RETURNING ${TX_FIELDS}`,
      [
        now.toISOString().replace('T', ' ').replace('Z', ''),
        data.washer_id,
        data.category.toUpperCase(),
        result.transaction_summary.expected_price,
        data.cash_paid,
        data.mpesa_paid,
        data.mpesa_transaction_id,
        data.mpesa_sender_name,
        data.manual_tip,
        data.tip_method.toUpperCase(),
        data.misc_amount || 0,
        data.misc_description,
        data.has_car_wash,
        data.has_vacuum,
        data.has_engine_wash,
        data.plate_number,
        md?.customer_phone ?? null,
        data.custom_category,
        md?.characteristics ?? null,
        md?.receiver_id ?? null,
        result.transaction_summary.total_customer_paid,
        result.transaction_summary.isolated_tip,
        result.transaction_summary.net_business_remittance,
        result.transaction_summary.shortfall_detected,
        result.employee_financials.calculated_commission,
        result.employee_financials.net_wage_before_tip,
        result.employee_financials.final_payout_output,
        week_id,
      ],
    );
    const tx = insert.rows[0] as TxRow;

    const credit = result.ledger_routing.credit_employee_wages;
    const debit = result.ledger_routing.debit_employee_debt;
    await client.query(
      'UPDATE users SET payable_balance = payable_balance + $1, debt_balance = debt_balance + $2 WHERE id = $3',
      [credit, debit, data.washer_id],
    );

    await syncChaiExpense(client, tx, result.transaction_summary.isolated_tip, washer.full_name ?? '');
    await client.query('COMMIT');

    return {
      id: tx.id,
      timestamp: iso(tx.timestamp) ?? '',
      transaction_summary: result.transaction_summary,
      employee_financials: result.employee_financials,
      ledger_routing: result.ledger_routing,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Mirrors _sync_chai_expense: for CASH-isolated tips, record a "Chai (tip)" expense linked to the tx.
async function syncChaiExpense(
  client: any,
  tx: TxRow,
  isolated_tip: number,
  washerName: string,
): Promise<void> {
  await client.query('DELETE FROM expenses WHERE transaction_id = $1', [tx.id]);
  if (isolated_tip > 0 && tx.tip_method === 'CASH') {
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    await client.query(
      `INSERT INTO expenses (timestamp, description, amount, category, week_id, transaction_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [now, `Chai (tip) - ${washerName}`, isolated_tip, 'Chai', tx.week_id, tx.id],
    );
  }
}

async function reverseBalances(client: any, tx: TxRow): Promise<void> {
  const credit = Math.max(0.0, tx.final_payout);
  const debit = Math.abs(Math.min(0.0, tx.final_payout));
  await client.query(
    'UPDATE users SET payable_balance = payable_balance - $1, debt_balance = debt_balance - $2 WHERE id = $3',
    [credit, debit, tx.washer_id],
  );
}

// GET /transactions
router.get(
  '/',
  wrap(async (req: AuthRequest, res) => {
    validateDay((req.query.day as string) ?? null);
    const day = req.query.day as string | undefined;
    const week_id = req.query.week_id as string | undefined;
    const washer_id = req.query.washer_id as string | undefined;
    const user = await getCurrentUser(req);

    const conds: string[] = [];
    const params: any[] = [];
    if (day) {
      params.push(day);
      conds.push(`date(timestamp) = $${params.length}::date`);
    } else if (week_id) {
      params.push(week_id);
      conds.push(`week_id = $${params.length}`);
    }
    if (washer_id) {
      const wid = Number(washer_id);
      if (!Number.isInteger(wid)) throw new HttpError(422, 'washer_id must be an integer');
      params.push(wid);
      conds.push(`washer_id = $${params.length}`);
    }
    if (user.role.toUpperCase() === 'EMPLOYEE') {
      params.push(user.id);
      conds.push(`washer_id = $${params.length}`);
    }

    const rows = await (
      await pool.query(
        `SELECT ${TX_FIELDS} FROM transactions ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''} ORDER BY timestamp DESC`,
        params,
      )
    ).rows;
    res.json(rows.map(serializeTx));
  }),
);

// POST /transactions
router.post(
  '/',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, ROLES.slice(0, 2)); // ADMIN, MANAGER
    const data = parseCreate(req.body || {});
    const result = await createTransactionCore(data, req.user!);
    res.status(200).json(result);
  }),
);

// PUT /transactions/:id
router.put(
  '/:id',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, ROLES.slice(0, 2));
    const txId = Number(req.params.id);
    if (!Number.isInteger(txId)) throw new HttpError(404, 'Transaction not found');

    const body = req.body || {};
    const updates = (() => {
      const u: Record<string, any> = {};
      for (const k of [
        'washer_id', 'category', 'expected_price', 'cash_paid', 'mpesa_paid', 'mpesa_transaction_id',
        'mpesa_sender_name', 'manual_tip', 'tip_method', 'misc_amount', 'misc_description', 'has_car_wash',
        'has_vacuum', 'has_engine_wash', 'plate_number', 'custom_category', 'carpet_metadata',
      ]) {
        if (body[k] !== undefined) u[k] = body[k];
      }
      return u;
    })();
    const notPresent = (k: string) => updates[k] === undefined;

    const tx = await queryOne<TxRow>(`SELECT ${TX_FIELDS} FROM transactions WHERE id = $1`, [txId]);
    if (!tx) throw new HttpError(404, 'Transaction not found');

    const merged = mergeUpdate(tx, updates);
    if (updates.carpet_metadata !== undefined) {
      merged.carpet_metadata = parseMetadata(updates.carpet_metadata);
    }
    const result = calculateTransaction(merged);
    validateMisc(merged);
    const washer = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [merged.washer_id]);
    if (!washer) throw new HttpError(404, 'Washer not found');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await reverseBalances(client, tx);

      const md = merged.carpet_metadata;
      await client.query(
        `UPDATE transactions SET
          washer_id=$1, category=$2, expected_price=$3, cash_paid=$4, mpesa_paid=$5, mpesa_transaction_id=$6,
          mpesa_sender_name=$7, manual_tip=$8, tip_method=$9, misc_amount=$10, misc_description=$11,
          has_car_wash=$12, has_vacuum=$13, has_engine_wash=$14, plate_number=$15, customer_phone=$16,
          custom_category=$17, carpet_characteristics=$18, receiver_id=$19, total_paid=$20, isolated_tip=$21,
          net_business_remittance=$22, shortfall=$23, calculated_commission=$24, net_wage_before_tip=$25,
          final_payout=$26
         WHERE id=$27`,
        [
          merged.washer_id,
          merged.category.toUpperCase(),
          result.transaction_summary.expected_price,
          merged.cash_paid,
          merged.mpesa_paid,
          merged.mpesa_transaction_id,
          merged.mpesa_sender_name,
          merged.manual_tip,
          merged.tip_method.toUpperCase(),
          merged.misc_amount || 0,
          merged.misc_description,
          merged.has_car_wash,
          merged.has_vacuum,
          merged.has_engine_wash,
          merged.plate_number,
          md?.customer_phone ?? null,
          merged.custom_category,
          md?.characteristics ?? null,
          md?.receiver_id ?? null,
          result.transaction_summary.total_customer_paid,
          result.transaction_summary.isolated_tip,
          result.transaction_summary.net_business_remittance,
          result.transaction_summary.shortfall_detected,
          result.employee_financials.calculated_commission,
          result.employee_financials.net_wage_before_tip,
          result.employee_financials.final_payout_output,
          txId,
        ],
      );

      const credit = result.ledger_routing.credit_employee_wages;
      const debit = result.ledger_routing.debit_employee_debt;
      await client.query(
        'UPDATE users SET payable_balance = payable_balance + $1, debt_balance = debt_balance + $2 WHERE id = $3',
        [credit, debit, merged.washer_id],
      );

      const refreshed = (await client.query(`SELECT ${TX_FIELDS} FROM transactions WHERE id = $1`, [txId])).rows[0] as TxRow;
      await syncChaiExpense(client, refreshed, result.transaction_summary.isolated_tip, washer.full_name ?? '');
      await client.query('COMMIT');

      res.json({
        id: txId,
        timestamp: iso(refreshed.timestamp),
        transaction_summary: result.transaction_summary,
        employee_financials: result.employee_financials,
        ledger_routing: result.ledger_routing,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }),
);

// DELETE /transactions/:id
router.delete(
  '/:id',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, ROLES.slice(0, 2));
    const txId = Number(req.params.id);
    if (!Number.isInteger(txId)) throw new HttpError(404, 'Transaction not found');
    const tx = await queryOne<TxRow>(`SELECT ${TX_FIELDS} FROM transactions WHERE id = $1`, [txId]);
    if (!tx) throw new HttpError(404, 'Transaction not found');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await reverseBalances(client, tx);
      await client.query('DELETE FROM expenses WHERE transaction_id = $1', [txId]);
      await client.query('DELETE FROM transactions WHERE id = $1', [txId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.json({ message: 'Transaction deleted' });
  }),
);

// Merge existing transaction with a TransactionUpdate into a CreateData.
function mergeUpdate(tx: TxRow, u: Record<string, any>): CreateData {
  const present = <T>(k: string, or: T): T => (u[k] !== undefined ? (u[k] as T) : or);
  const data: CreateData = {
    washer_id: asOptInt(present('washer_id', tx.washer_id), 'washer_id')!,
    category: requireEnum(
      present('category', tx.category.toLowerCase()),
      SERVICE_CATEGORIES,
      'category',
    ),
    expected_price: asOptFloat(present('expected_price', tx.expected_price), 'expected_price')!,
    cash_paid: asOptFloat(present('cash_paid', tx.cash_paid), 'cash_paid')!,
    mpesa_paid: asOptFloat(present('mpesa_paid', tx.mpesa_paid), 'mpesa_paid')!,
    mpesa_transaction_id: present('mpesa_transaction_id', tx.mpesa_transaction_id) ?? null,
    mpesa_sender_name: present('mpesa_sender_name', tx.mpesa_sender_name) ?? null,
    manual_tip: asOptFloat(present('manual_tip', tx.manual_tip), 'manual_tip') ?? 0,
    tip_method: requireEnum(
      present('tip_method', tx.tip_method.toLowerCase()),
      TIP_METHODS,
      'tip_method',
    ),
    misc_amount: asOptFloat(present('misc_amount', tx.misc_amount ?? 0), 'misc_amount') ?? 0,
    misc_description: present('misc_description', tx.misc_description) ?? null,
    has_car_wash: asBool(present('has_car_wash', tx.has_car_wash), 'has_car_wash'),
    has_vacuum: asBool(present('has_vacuum', tx.has_vacuum), 'has_vacuum'),
    has_engine_wash: asBool(present('has_engine_wash', tx.has_engine_wash), 'has_engine_wash'),
    plate_number: present('plate_number', tx.plate_number) ?? null,
    custom_category: present('custom_category', tx.custom_category) ?? null,
    carpet_metadata: tx.customer_phone || tx.carpet_characteristics || tx.receiver_id
      ? {
          characteristics: tx.carpet_characteristics ?? '',
          receiver_id: tx.receiver_id ?? 0,
          customer_phone: tx.customer_phone,
        }
      : null,
  };
  for (const k of ['expected_price', 'cash_paid', 'mpesa_paid', 'manual_tip', 'misc_amount']) {
    if ((data as any)[k] < 0) throw new HttpError(422, `${k} must be >= 0`);
  }
  return data;
}

export default router;