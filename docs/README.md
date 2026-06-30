# Carwash POS & Ledger System Documentation

## Overview
A modern POS and financial reconciliation system designed for carwash businesses. Tracks revenue, tips, employee commissions, and debts.

## Financial Logic
- **Commission**: Standard 30% of expected price.
- **Under-70 Rule**: 0% commission for services under 70 Ksh.
- **Flat Rates**:
  - Motorcycle (70 Ksh) -> 30 Ksh wage.
  - Normal Car (200 Ksh) -> 70 Ksh wage.
- **Full Package Floor**: Wash + Vacuum + Engine Wash has a mandatory 600 Ksh floor. If priced lower, a shortfall penalty is applied.
- **Shortfall Penalty**: (Expected Price - Net Remitted) is deducted from commission.
- **Zero Remittance**: If no money is remitted, commission is forfeited and the employee is penalized the full cost.

## Roles
- **Admin**: Full access, stats, employee management, resets.
- **Manager**: Transaction and repayment input.
- **Employee**: Performance tracking.

## Weekly Reset
Every Sunday at 11:59 PM, employee payable balances are reset to zero. Debt balances persist.

## Tech Stack
- **Backend**: FastAPI, PostgreSQL, SQLAlchemy.
- **Frontend**: React, TypeScript, Tailwind CSS, Recharts.
