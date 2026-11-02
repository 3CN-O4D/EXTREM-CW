// Faithful port of backend/app/services/finance.py
import { HttpError } from './utils';

export interface FinanceInput {
  category: string; // lowercase
  expected_price: number;
  cash_paid: number;
  mpesa_paid: number;
  manual_tip: number;
  misc_amount: number;
  has_car_wash: boolean;
  has_vacuum: boolean;
  has_engine_wash: boolean;
  tip_method: string; // lowercase
}

export interface TransactionSummary {
  expected_price: number;
  total_customer_paid: number;
  isolated_tip: number;
  misc_amount: number;
  net_business_remittance: number;
  shortfall_detected: number;
}

export interface EmployeeFinancials {
  calculated_commission: number;
  net_wage_before_tip: number;
  final_payout_output: number;
}

export interface LedgerRouting {
  credit_employee_wages: number;
  debit_employee_debt: number;
  business_gross_revenue: number;
  business_labor_expense: number;
}

export interface FinanceResult {
  transaction_summary: TransactionSummary;
  employee_financials: EmployeeFinancials;
  ledger_routing: LedgerRouting;
}

export interface PriceConfig {
  min_price: number;
  max_price: number;
  commission_percent: number;
}

export function calculateTransaction(data: FinanceInput, prices?: Record<string, PriceConfig>): FinanceResult {
  let expected_price = data.expected_price;
  const priceCfg = prices?.[data.category];

  // 1. Vacuum & Engine Wash Floor Rules (Full Package)
  if (data.has_car_wash && data.has_vacuum && data.has_engine_wash) {
    const pkgMax = priceCfg?.max_price ?? 800;
    if (expected_price < pkgMax) expected_price = pkgMax;
  }

  // 2. Commission Calculation — uses commission_percent from the prices table.
  // If expected_price is below min_price, no commission is earned (e.g. motorcycle paid 50 -> 0).
  let commission = 0.0;
  const cp = priceCfg?.commission_percent ?? 30;
  const minP = priceCfg?.min_price ?? 0;
  if (expected_price >= minP && minP > 0) {
    commission = expected_price * cp / 100.0;
  } else if (minP === 0) {
    // categories without a price floor (e.g. other): straight percentage
    commission = expected_price * cp / 100.0;
  }

  // 3. Tip Isolation
  const total_paid = data.cash_paid + data.mpesa_paid;
  const misc_amount = data.misc_amount || 0.0;
  let isolated_tip = 0.0;

  if (total_paid > expected_price) {
    isolated_tip = Math.max(0.0, total_paid - expected_price - misc_amount);
  }
  isolated_tip += data.manual_tip;

  const net_business_remittance = total_paid - isolated_tip;
  const gross_shortfall = Math.max(0.0, expected_price - net_business_remittance);

  // Shortfall allowance — how far below max_price can remittance fall before it counts as debt.
  // - Standalone vacuum/engine: allowance = min_price (200)
  // - Car + any add-on (vacuum/engine): allowance = min_price (200)
  let makes_allowance = 0.0;
  if ((data.category === 'vacuum' || data.category === 'engine') && !(data.has_car_wash)) {
    makes_allowance = priceCfg?.min_price ?? 200.0;
  } else if (data.category === 'car' && (data.has_vacuum || data.has_engine_wash)) {
    makes_allowance = priceCfg?.min_price ?? 200.0;
  }
  const shortfall = Math.max(0.0, gross_shortfall - makes_allowance);

  // 4. Shortfall & Zero-Remittance Penalties
  let net_wage_before_tip = 0.0;
  if (net_business_remittance === 0) {
    net_wage_before_tip = -expected_price;
  } else {
    net_wage_before_tip = commission - shortfall;
  }

  // 5. Final Payout Calculation
  let final_payout = net_wage_before_tip;
  if (data.tip_method === 'wages') {
    final_payout += isolated_tip;
  }

  // Ledger Routing
  const credit_employee_wages = Math.max(0.0, final_payout);
  const debit_employee_debt = Math.abs(Math.min(0.0, final_payout));

  return {
    transaction_summary: {
      expected_price,
      total_customer_paid: total_paid,
      isolated_tip,
      misc_amount,
      net_business_remittance,
      shortfall_detected: shortfall,
    },
    employee_financials: {
      calculated_commission: commission,
      net_wage_before_tip,
      final_payout_output: final_payout,
    },
    ledger_routing: {
      credit_employee_wages,
      debit_employee_debt,
      business_gross_revenue: net_business_remittance,
      business_labor_expense: credit_employee_wages,
    },
  };
}

// FastAPI/Pydantic-style body validation helpers.
export function asFloat(v: unknown, field: string): number {
  const n = Number(v);
  if (v === null || v === undefined || v === '' || !Number.isFinite(n)) {
    throw new HttpError(422, `${field} must be a number`);
  }
  return n;
}

export function asOptFloat(v: unknown, field: string): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new HttpError(422, `${field} must be a number`);
  return n;
}

export function asInt(v: unknown, field: string): number {
  const n = Number(v);
  if (v === null || v === undefined || v === '' || !Number.isInteger(n)) {
    throw new HttpError(422, `${field} must be an integer`);
  }
  return n;
}

export function asOptInt(v: unknown, field: string): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new HttpError(422, `${field} must be an integer`);
  return n;
}

export function asBool(v: unknown, field: string): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === true) return true;
  if (v === 'false' || v === false) return false;
  throw new HttpError(422, `${field} must be a boolean`);
}

export function asOptStr(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') throw new HttpError(422, 'expected a string');
  return v;
}

export function requireEnum(v: string, allowed: string[], field: string): string {
  if (!allowed.includes(v)) {
    throw new HttpError(422, `value is not a valid enumeration member for ${field}`);
  }
  return v;
}