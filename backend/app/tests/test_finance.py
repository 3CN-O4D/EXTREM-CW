from backend.app.schemas.schemas import TransactionCreate, ServiceCategory, TipMethod
from backend.app.services.finance import calculate_transaction

def test_full_package_floor_penalty():
    # Scenario A: Full Package discounted too much (500 ksh)
    data = TransactionCreate(
        washer_id=1,
        category=ServiceCategory.CAR,
        expected_price=500, # Input price
        cash_paid=500,
        mpesa_paid=0,
        tip_method=TipMethod.CASH,
        has_car_wash=True,
        has_vacuum=True,
        has_engine_wash=True
    )
    result = calculate_transaction(data)
    assert result.transaction_summary.expected_price == 600
    assert result.transaction_summary.shortfall_detected == 100
    # 30% of 600 = 180. 180 - 100 shortfall = 80.
    assert result.employee_financials.net_wage_before_tip == 80

def test_motorcycle_flat_rate():
    data = TransactionCreate(
        washer_id=1,
        category=ServiceCategory.MOTORCYCLE,
        expected_price=70,
        cash_paid=100, # Paid 100, expected 70 -> 30 tip
        mpesa_paid=0,
        tip_method=TipMethod.CASH,
    )
    result = calculate_transaction(data)
    assert result.transaction_summary.isolated_tip == 30
    assert result.employee_financials.calculated_commission == 30
    assert result.employee_financials.net_wage_before_tip == 30

def test_zero_remittance_penalty():
    data = TransactionCreate(
        washer_id=1,
        category=ServiceCategory.CAR,
        expected_price=200,
        cash_paid=0,
        mpesa_paid=0,
        tip_method=TipMethod.CASH,
    )
    result = calculate_transaction(data)
    assert result.employee_financials.net_wage_before_tip == -200
    assert result.ledger_routing.debit_employee_debt == 200

if __name__ == "__main__":
    test_full_package_floor_penalty()
    test_motorcycle_flat_rate()
    test_zero_remittance_penalty()
    print("Finance tests passed!")
