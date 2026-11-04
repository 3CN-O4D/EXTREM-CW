// FastAPI response serialization equivalents: enum columns stored uppercase in
// the DB are returned lowercase; datetimes are returned as ISO strings.
import type {
  TxRow,
  ExpenseRow,
  RepaymentRow,
  DebtRow,
  TipRow,
  ClientDebtRow,
  WeeklyLogRow,
  PriceRow,
  CarpetRow,
  UserRow,
} from './types';
import { money } from './finance';

export function iso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

const f = (n: number | null | undefined) => money(n);

export function serializeTx(t: TxRow): Record<string, unknown> {
  return {
    id: t.id,
    timestamp: iso(t.timestamp),
    washer_id: t.washer_id,
    category: t.category.toLowerCase(),
    expected_price: money(t.expected_price),
    cash_paid: money(t.cash_paid),
    mpesa_paid: money(t.mpesa_paid),
    mpesa_transaction_id: t.mpesa_transaction_id,
    mpesa_sender_name: t.mpesa_sender_name,
    manual_tip: money(t.manual_tip),
    tip_method: t.tip_method.toLowerCase(),
    misc_amount: money(t.misc_amount),
    misc_description: t.misc_description,
    has_car_wash: t.has_car_wash,
    has_vacuum: t.has_vacuum,
    has_engine_wash: t.has_engine_wash,
    plate_number: t.plate_number,
    customer_phone: t.customer_phone,
    custom_category: t.custom_category,
    carpet_characteristics: t.carpet_characteristics,
    receiver_id: t.receiver_id,
    total_paid: money(t.total_paid),
    isolated_tip: money(t.isolated_tip),
    net_business_remittance: money(t.net_business_remittance),
    shortfall: money(t.shortfall),
    calculated_commission: money(t.calculated_commission),
    net_wage_before_tip: money(t.net_wage_before_tip),
    final_payout: money(t.final_payout),
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
    amount: money(e.amount),
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
    amount: money(r.amount),
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
    other_name: d.other_name ?? null,
    amount: money(d.amount),
    service: d.service,
    date: iso(d.date),
    paid: money(d.paid),
    paid_date: iso(d.paid_date),
    notes: d.notes,
    transaction_id: d.transaction_id ?? null,
    balance: money(d.amount - d.paid),
  };
}

export function serializeTip(t: TipRow): Record<string, unknown> {
  return {
    id: t.id,
    timestamp: iso(t.timestamp),
    employee_id: t.employee_id,
    amount: money(t.amount),
    method: t.method.toLowerCase(),
    week_id: t.week_id,
    notes: t.notes,
  };
}

export function serializeClientDebt(c: ClientDebtRow): Record<string, unknown> {
  return {
    id: c.id,
    client_name: c.client_name,
    customer_phone: c.customer_phone,
    description: c.description,
    amount: money(c.amount),
    paid: money(c.paid),
    balance: money(c.amount - c.paid),
    date: iso(c.date),
    paid_date: iso(c.paid_date),
    notes: c.notes,
    created_at: iso(c.created_at),
  };
}

export function serializeWeeklyLog(w: WeeklyLogRow): Record<string, unknown> {
  return {
    id: w.id,
    week_id: w.week_id,
    start_date: iso(w.start_date),
    end_date: iso(w.end_date),
    total_revenue: money(w.total_revenue),
    total_expenses: money(w.total_expenses),
    total_labor_expense: money(w.total_labor_expense),
    total_profit: money(w.total_profit),
    data: w.data_json ? JSON.parse(w.data_json) : null,
  };
}

export function serializePrice(p: PriceRow): Record<string, unknown> {
  return {
    id: p.id,
    category: p.category,
    min_price: money(p.min_price),
    max_price: money(p.max_price),
    commission_percent: Number(p.commission_percent),
    is_active: p.is_active,
    created_at: iso(p.created_at),
    updated_at: iso(p.updated_at),
  };
}

function carpetJson(c: CarpetRow, includeImage: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: c.id,
    created_at: iso(c.created_at),
    receiver_id: c.receiver_id,
    submitter_id: c.submitter_id ?? null,
    characteristics: c.characteristics,
    client_name: c.client_name,
    customer_phone: c.customer_phone,
    image_thumb: c.image_thumb,
    image_washed_thumb: c.image_washed_thumb,
    image_ready_thumb: c.image_ready_thumb,
    expected_price: money(c.expected_price),
    cash_paid: money(c.cash_paid),
    mpesa_paid: money(c.mpesa_paid),
    is_washed: c.is_washed,
    status: c.status,
    washed_at: iso(c.washed_at),
    dried_at: iso(c.dried_at),
    ready_at: iso(c.ready_at),
    released_at: iso(c.released_at),
  };
  // Full photos ride along only on detail responses; list payloads stay small
  // so GET /carpets never risks Vercel's ~4.5MB response cap.
  if (includeImage) {
    out.image_data = c.image_data;
    out.image_washed = c.image_washed;
    out.image_ready = c.image_ready;
  }
  return out;
}

export function serializeCarpet(c: CarpetRow): Record<string, unknown> {
  return carpetJson(c, true);
}

export function serializeCarpetList(c: CarpetRow): Record<string, unknown> {
  return carpetJson(c, false);
}