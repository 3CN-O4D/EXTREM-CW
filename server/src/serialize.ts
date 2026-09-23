// FastAPI response serialization equivalents: enum columns stored uppercase in
// the DB are returned lowercase; datetimes are returned as ISO strings.
import type { TxRow, ExpenseRow, RepaymentRow, DebtRow, CarpetRow, UserRow } from './types';

export function iso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

const f = (n: number | null | undefined) => (n === null || n === undefined ? 0 : n);

export function serializeTx(t: TxRow): Record<string, unknown> {
  return {
    id: t.id,
    timestamp: iso(t.timestamp),
    washer_id: t.washer_id,
    category: t.category.toLowerCase(),
    expected_price: t.expected_price,
    cash_paid: t.cash_paid,
    mpesa_paid: t.mpesa_paid,
    mpesa_transaction_id: t.mpesa_transaction_id,
    mpesa_sender_name: t.mpesa_sender_name,
    manual_tip: t.manual_tip,
    tip_method: t.tip_method.toLowerCase(),
    misc_amount: t.misc_amount,
    misc_description: t.misc_description,
    has_car_wash: t.has_car_wash,
    has_vacuum: t.has_vacuum,
    has_engine_wash: t.has_engine_wash,
    plate_number: t.plate_number,
    customer_phone: t.customer_phone,
    custom_category: t.custom_category,
    carpet_characteristics: t.carpet_characteristics,
    receiver_id: t.receiver_id,
    total_paid: t.total_paid,
    isolated_tip: t.isolated_tip,
    net_business_remittance: t.net_business_remittance,
    shortfall: t.shortfall,
    calculated_commission: t.calculated_commission,
    net_wage_before_tip: t.net_wage_before_tip,
    final_payout: t.final_payout,
    week_id: t.week_id,
  };
}

export function serializeUser(u: UserRow, includeHash = false): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: u.id,
    full_name: u.full_name,
    abbreviation: u.abbreviation,
    role: u.role.toLowerCase(),
    is_active: u.is_active,
    payable_balance: f(u.payable_balance),
    debt_balance: f(u.debt_balance),
  };
  if (includeHash) out.hashed_password = u.hashed_password;
  return out;
}

export function serializeExpense(e: ExpenseRow): Record<string, unknown> {
  return {
    id: e.id,
    timestamp: iso(e.timestamp),
    description: e.description,
    amount: e.amount,
    category: e.category,
    week_id: e.week_id,
    transaction_id: e.transaction_id,
  };
}

export function serializeRepayment(r: RepaymentRow & { employee_name?: string; abbreviation?: string }): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: r.id,
    timestamp: iso(r.timestamp),
    employee_id: r.employee_id,
    amount: r.amount,
    week_id: r.week_id,
    employee_name: r.employee_name ?? null,
    abbreviation: r.abbreviation ?? null,
  };
  return out;
}

export function serializeDebt(d: DebtRow): Record<string, unknown> {
  return {
    id: d.id,
    employee_id: d.employee_id,
    amount: d.amount,
    service: d.service,
    date: iso(d.date),
    paid: d.paid,
    paid_date: iso(d.paid_date),
    notes: d.notes,
    balance: d.amount - d.paid,
  };
}

export function serializeCarpet(c: CarpetRow): Record<string, unknown> {
  return {
    id: c.id,
    created_at: iso(c.created_at),
    receiver_id: c.receiver_id,
    characteristics: c.characteristics,
    client_name: c.client_name,
    customer_phone: c.customer_phone,
    image_data: c.image_data,
    expected_price: c.expected_price,
    cash_paid: c.cash_paid,
    mpesa_paid: c.mpesa_paid,
    is_washed: c.is_washed,
    status: c.status,
    released_at: iso(c.released_at),
  };
}