import { describe, it, expect } from 'vitest';
import { calculateTransaction } from '../src/finance';

const base = (over: Record<string, unknown> = {}) => ({
  category: 'car',
  expected_price: 200,
  cash_paid: 200,
  mpesa_paid: 0,
  manual_tip: 0,
  misc_amount: 0,
  has_car_wash: false,
  has_vacuum: false,
  has_engine_wash: false,
  tip_method: 'cash',
  ...over,
});

describe('calculateTransaction', () => {
  it('full package floor: expected 500 -> 600, commission 180, shortfall 100, wage 80', () => {
    const r = calculateTransaction(
      base({ expected_price: 500, cash_paid: 500, has_car_wash: true, has_vacuum: true, has_engine_wash: true }),
    );
    expect(r.transaction_summary.expected_price).toBe(600);
    expect(r.transaction_summary.net_business_remittance).toBe(500);
    expect(r.transaction_summary.shortfall_detected).toBe(100);
    expect(r.employee_financials.calculated_commission).toBe(180);
    expect(r.employee_financials.net_wage_before_tip).toBe(80);
    expect(r.employee_financials.final_payout_output).toBe(80);
    // Ledger: wage credited 80, no debt
    expect(r.ledger_routing.credit_employee_wages).toBe(80);
    expect(r.ledger_routing.debit_employee_debt).toBe(0);
    expect(r.ledger_routing.business_gross_revenue).toBe(500);
    expect(r.ledger_routing.business_labor_expense).toBe(80);
  });

  it('motorcycle flat rate: 70 -> commission 30', () => {
    const r = calculateTransaction(base({ category: 'motorcycle', expected_price: 70, cash_paid: 70 }));
    expect(r.transaction_summary.expected_price).toBe(70);
    expect(r.employee_financials.calculated_commission).toBe(30);
    expect(r.employee_financials.final_payout_output).toBe(30);
  });

  it('zero remittance theft protection: net wage = -expected (200)', () => {
    const r = calculateTransaction(base({ expected_price: 200, cash_paid: 0 }));
    expect(r.employee_financials.net_wage_before_tip).toBe(-200);
    expect(r.employee_financials.final_payout_output).toBe(-200);
    expect(r.ledger_routing.credit_employee_wages).toBe(0);
    expect(r.ledger_routing.debit_employee_debt).toBe(200);
  });

  it('below 70 -> no commission', () => {
    const r = calculateTransaction(base({ expected_price: 60, cash_paid: 60 }));
    expect(r.employee_financials.calculated_commission).toBe(0);
    expect(r.employee_financials.final_payout_output).toBe(0);
  });

  it('taxi @ 100 -> commission 0', () => {
    const r = calculateTransaction(base({ category: 'taxi', expected_price: 100, cash_paid: 100 }));
    expect(r.employee_financials.calculated_commission).toBe(0);
  });

  it('car @ 200 plain -> commission 70 flat', () => {
    const r = calculateTransaction(base({ category: 'car', expected_price: 200, cash_paid: 200 }));
    expect(r.employee_financials.calculated_commission).toBe(70);
  });

  it('standard 30%: car @ 500 -> commission 150, full paid, tip 0, wage 150', () => {
    const r = calculateTransaction(base({ expected_price: 500, cash_paid: 500 }));
    expect(r.employee_financials.calculated_commission).toBe(150);
    expect(r.transaction_summary.shortfall_detected).toBe(0);
    expect(r.employee_financials.final_payout_output).toBe(150);
  });

  it('overpayment isolates tip (cash): tip not in remittance, not in wage', () => {
    const r = calculateTransaction(base({ expected_price: 200, cash_paid: 300 }));
    expect(r.transaction_summary.isolated_tip).toBe(100);
    expect(r.transaction_summary.net_business_remittance).toBe(200);
    expect(r.employee_financials.final_payout_output).toBe(70); // commission only
  });

  it('tip_method=wages adds isolated tip to payout', () => {
    const r = calculateTransaction(base({ expected_price: 200, cash_paid: 300, tip_method: 'wages' }));
    expect(r.transaction_summary.isolated_tip).toBe(100);
    expect(r.employee_financials.final_payout_output).toBe(170); // 70 + 100
    expect(r.ledger_routing.credit_employee_wages).toBe(170);
  });

  it('manual tip adds on top without affecting remittance', () => {
    const r = calculateTransaction(base({ expected_price: 200, cash_paid: 200, manual_tip: 50 }));
    expect(r.transaction_summary.isolated_tip).toBe(50);
    expect(r.transaction_summary.net_business_remittance).toBe(150);
    // remittance short no auto-tip, but manual tip is an isolated-tip off-wage
    expect(r.employee_financials.final_payout_output).toBe(20); // 70 commission - 50 shortfall
  });

  it('misc reduces isolated tip (classified misc is not tip)', () => {
    const r = calculateTransaction(base({ expected_price: 200, cash_paid: 350, misc_amount: 50 }));
    expect(r.transaction_summary.isolated_tip).toBe(100); // 150 overpaid - 50 misc
    expect(r.transaction_summary.misc_amount).toBe(50);
    expect(r.transaction_summary.net_business_remittance).toBe(250);
  });

  it('shortfall subtracts from commission and may exceed it', () => {
    const r = calculateTransaction(base({ category: 'car', expected_price: 200, cash_paid: 100 }));
    expect(r.transaction_summary.shortfall_detected).toBe(100);
    expect(r.employee_financials.calculated_commission).toBe(70);
    expect(r.employee_financials.final_payout_output).toBe(-30);
    expect(r.ledger_routing.debit_employee_debt).toBe(30);
  });
});