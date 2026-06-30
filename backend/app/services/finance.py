from backend.app.models.models import ServiceCategory, TipMethod
from backend.app.schemas.schemas import TransactionCreate, TransactionResponse, TransactionSummary, EmployeeFinancials, LedgerRouting

def calculate_transaction(data: TransactionCreate) -> TransactionResponse:
    expected_price = data.expected_price

    # 1. Vacuum & Engine Wash Floor Rules (Full Package)
    if data.has_car_wash and data.has_vacuum and data.has_engine_wash:
        if expected_price < 600:
            expected_price = 600

    # 2. Commission Calculation
    commission = 0.0
    if expected_price < 70:
        commission = 0.0
    elif data.category == ServiceCategory.TAXI and expected_price == 100:
        commission = 0.0
    elif data.category == ServiceCategory.MOTORCYCLE and expected_price == 70:
        commission = 30.0
    elif data.category == ServiceCategory.CAR and expected_price == 200 and not (data.has_vacuum or data.has_engine_wash):
        commission = 70.0
    else:
        # Standard Tier (30%)
        commission = expected_price * 0.30

    # 3. Tip Isolation
    total_paid = data.cash_paid + data.mpesa_paid
    isolated_tip = 0.0

    # Automatic Tips for certain categories
    if data.category in [ServiceCategory.CAR, ServiceCategory.TAXI, ServiceCategory.MOTORCYCLE]:
        if total_paid > expected_price:
            isolated_tip = total_paid - expected_price
    else:
        # Manual Tips for others
        isolated_tip = data.manual_tip

    net_remitted = total_paid - isolated_tip
    shortfall = max(0.0, expected_price - net_remitted)

    # 4. Shortfall & Zero-Remittance Penalties
    net_wage_before_tip = 0.0
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
    credit_wages = max(0.0, final_payout)
    debit_debt = abs(min(0.0, final_payout))

    return TransactionResponse(
        transaction_summary=TransactionSummary(
            expected_price=expected_price,
            total_customer_paid=total_paid,
            isolated_tip=isolated_tip,
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
