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
  // Motorcycle has a tiered commission: below min_price -> 0 commission + shortfall.
  // paid 50 -> 0, paid 60 -> 10, paid 70 -> 30 (each Ksh above 60 earns 2 Ksh commission).
  let commission = 0.0;
  const cp = Number(priceCfg?.commission_percent ?? 30);
  const minP = Number(priceCfg?.min_price ?? 0);
  const maxP = Number(priceCfg?.max_price ?? 0);
  const total_paid = data.cash_paid + data.mpesa_paid;

  if (data.category === 'motorcycle' && minP > 0) {
    if (total_paid < minP) {
      commission = 0.0;
    } else if (total_paid <= minP + 10) {
      commission = total_paid - minP;
    } else {
      commission = 10.0 + 2.0 * (total_paid - (minP + 10));
    }
  } else if (data.category === 'car' && (data.has_vacuum || data.has_engine_wash)) {
    // Any car combo (car+vacuum, car+engine, car+both) earns flat 30% commission.
    commission = expected_price * 30.0 / 100.0;
  } else if (expected_price >= minP && minP > 0) {
    commission = expected_price * cp / 100.0;
  } else if (minP === 0) {
    commission = expected_price * cp / 100.0;
  }

  // 3. Tip Isolation
  const misc_amount = data.misc_amount || 0.0;
  let isolated_tip = 0.0;

  if (total_paid > expected_price) {
    isolated_tip = Math.max(0.0, total_paid - expected_price - misc_amount);
  }
  isolated_tip += data.manual_tip;

  const net_business_remittance = total_paid - isolated_tip;

  // Shortfall calculation:
  // - Motorcycle: threshold is min_price. Below it, shortfall = min_price - paid; commission = 0.
  //   At/above min_price, no shortfall.
  // - Combos (car + vacuum/engine): below min_price, commission = min_price × %, shortfall = min_price - paid.
  //   At/above min_price, normal commission, no shortfall.
  //   Combo min/max = sum of individual component min/max prices.
  // - Standalone vacuum/engine: allowance = min_price.
  let effectivePriceForShortfall = expected_price;
  let makes_allowance = 0.0;

  if (data.category === 'motorcycle' && minP > 0) {
    if (total_paid < minP) {
      effectivePriceForShortfall = minP;
      makes_allowance = 0.0;
      commission = 0.0; // no commission if paid below min
    } else {
      makes_allowance = maxP - minP; // covers gap between min and max -> no shortfall
    }
  } else if ((data.category === 'vacuum' || data.category === 'engine') && !(data.has_car_wash)) {
    makes_allowance = Number(priceCfg?.min_price ?? 200.0);
  } else if (data.category === 'car' && (data.has_vacuum || data.has_engine_wash)) {
    const vacuumCfg = prices?.vacuum;
    const engineCfg = prices?.engine;
    const hasBoth = data.has_vacuum && data.has_engine_wash;

    if (hasBoth) {
      // 3-component combo: keep comboMin/comboMax logic
      const comboMin = minP + Number(data.has_vacuum ? vacuumCfg?.min_price ?? 0 : 0) + Number(data.has_engine_wash ? engineCfg?.min_price ?? 0 : 0);
      const comboMax = maxP + Number(data.has_vacuum ? vacuumCfg?.max_price ?? 0 : 0) + Number(data.has_engine_wash ? engineCfg?.max_price ?? 0 : 0);
      if (total_paid < comboMin) {
        effectivePriceForShortfall = comboMin;
        makes_allowance = 0.0;
        commission = total_paid * 30.0 / 100.0;
      } else {
        makes_allowance = comboMax - comboMin;
        commission = Math.min(total_paid, comboMax) * 30.0 / 100.0;
      }
    } else {
      // 2-component combo: per-component shortfall using min prices
      // Payment allocates: car first, then vacuum/engine up to their max
      const carMax = maxP; // 200
      const addonMax = Number(data.has_vacuum
        ? (vacuumCfg?.max_price ?? 300)
        : (engineCfg?.max_price ?? 300));

      const carPaid = Math.min(total_paid, carMax);
      const addonPaid = Math.max(0, Math.min(total_paid - carMax, addonMax));

      const carMin = minP; // 200
      const addonMin = Number(data.has_vacuum ? (vacuumCfg?.min_price ?? 200) : (engineCfg?.min_price ?? 200));

      effectivePriceForShortfall = carMin + addonMin;
      makes_allowance = 0.0;
      commission = (carPaid + addonPaid) * 30.0 / 100.0;
    }
  }
  const gross_shortfall = Math.max(0.0, effectivePriceForShortfall - net_business_remittance);
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