from app.models.models import ServiceCategory, TipMethod
from app.schemas.schemas import TransactionCreate, TransactionSummary, EmployeeFinancials, LedgerRouting
from types import SimpleNamespace


def money(n) -> int:
    """All money is whole shillings; round at the finance boundary."""
    try:
        return int(round(float(n or 0)))
    except (TypeError, ValueError):
        return 0


def calculate_transaction(data: TransactionCreate) -> SimpleNamespace:
    expected_price = money(data.expected_price)

    # 1. Vacuum & Engine Wash Floor Rules (Full Package)
    if data.has_car_wash and data.has_vacuum and data.has_engine_wash:
        if expected_price < 600:
            expected_price = 600

    # 2. Commission Calculation
    commission = 0
    if expected_price < 70:
        commission = 0
    elif data.category == ServiceCategory.TAXI and expected_price == 100:
        commission = 0
    elif data.category == ServiceCategory.MOTORCYCLE and expected_price == 70:
        commission = 30
    elif data.category == ServiceCategory.CAR and expected_price == 200 and not (data.has_vacuum or data.has_engine_wash):
        commission = 70
    else:
        # Standard Tier (30%)
        commission = money(expected_price * 30 / 100)

    # 3. Tip Isolation
    total_paid = money(data.cash_paid) + money(data.mpesa_paid)
    misc_amount = money(data.misc_amount)
    isolated_tip = 0

    # Auto-tip: overpayment on any category, minus any classified as miscellaneous
    if total_paid > expected_price:
        isolated_tip = max(0, total_paid - expected_price - misc_amount)
    # Manual tip always adds on top (e.g. customer paid exact but gave extra cash)
    isolated_tip += money(data.manual_tip)

    net_remitted = total_paid - isolated_tip
    shortfall = money(max(0, expected_price - net_remitted))

    # 4. Shortfall & Zero-Remittance Penalties
    net_wage_before_tip = 0
    if net_remitted == 0:
        # Zero Remittance (Theft Protection)
        net_wage_before_tip = -expected_price
    else:
        # Short Remittance
        net_wage_before_tip = commission - shortfall

    # 5. Final Payout Calculation
    final_payout = net_wage_before_tip
    if data.tip_method == TipMethod.WAGES:
        final_payout += isolated_tip

    # Ledger Routing
    credit_wages = money(max(0, final_payout))
    debit_debt = money(abs(min(0, final_payout)))

    return SimpleNamespace(
        transaction_summary=TransactionSummary(
            expected_price=expected_price,
            total_customer_paid=total_paid,
            isolated_tip=isolated_tip,
            misc_amount=misc_amount,
            net_business_remittance=net_remitted,
            shortfall_detected=shortfall
        ),
        employee_financials=EmployeeFinancials(
            calculated_commission=commission,
            net_wage_before_tip=net_wage_before_tip,
            final_payout_output=final_payout
        ),
        ledger_routing=LedgerRouting(
            credit_employee_wages=credit_wages,
            debit_employee_debt=debit_debt,
            business_gross_revenue=net_remitted,
            business_labor_expense=credit_wages
        )
    )
