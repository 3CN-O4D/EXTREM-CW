# Carwash POS & Ledger System

A modern POS and financial reconciliation system for carwash businesses. Tracks revenue, tips, employee commissions, debts, and generates performance reports.

---

## Setup & Running

### Prerequisites
- Python 3.13+
- Node.js 18+

### Backend
```bash
# Activate virtual environment
source python/bin/activate

# Install dependencies (first time only)
pip install -r backend/requirements.txt

# Seed database with default users
python backend/seed.py

# Start the API server
uvicorn app.main:app --reload --app-dir backend
```
API runs at `http://localhost:8000`. Swagger docs at `http://localhost:8000/docs`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs at `http://localhost:5173`.

### Default Login Credentials

| Role    | Abbreviation | Password |
|---------|-------------|----------|
| Admin   | `admin`     | `admin`  |
| Manager | `manager`   | `manager` |

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/          # API route handlers
│   │   │   ├── users.py       # Auth, user CRUD
│   │   │   ├── transactions.py # Transaction CRUD
│   │   │   ├── stats.py        # Business & employee stats
│   │   │   ├── expenses.py     # Business expenses
│   │   │   ├── repayments.py   # Employee debt repayments
│   │   │   ├── tips.py         # Employee tips ("Chai")
│   │   │   └── deps.py         # Auth dependencies
│   │   ├── core/
│   │   │   ├── config.py       # Settings (DB, JWT, etc.)
│   │   │   └── security.py     # Password hashing, JWT tokens
│   │   ├── db/
│   │   │   └── session.py      # SQLAlchemy engine & session
│   │   ├── models/
│   │   │   └── models.py       # All database models
│   │   ├── schemas/
│   │   │   └── schemas.py      # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── finance.py      # Commission & payout calculation
│   │   │   └── utils.py        # Week ID helper
│   │   └── main.py             # FastAPI app entry point
│   ├── requirements.txt
│   ├── seed.py                 # Creates manager & admin users
│   └── create_db.py
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Login.tsx               # Login form
│       │   ├── LandingPage.tsx          # Public landing
│       │   ├── AdminDashboard.tsx       # Business overview & employee stats
│       │   ├── ManagerPanel.tsx         # Transaction, expense, repayment, tip entry
│       │   ├── EmployeeDashboard.tsx    # Employee self-service stats
│       │   └── EmployeeManagement.tsx   # Admin CRUD for users
│       ├── context/
│       │   └── AuthContext.tsx          # Auth state management
│       └── services/
│           └── api.ts                  # Axios instance
├── python/            # Python virtual environment
└── docs/
    └── README.md      # This file
```

---

## User Roles

| Role      | Permissions |
|-----------|-------------|
| **Admin**  | Full access: business stats, employee management, all views, edit/delete any transaction |
| **Manager**| Log transactions, expenses, repayments, tips. View day/week data |
| **Employee**| View own performance, wages earned, debt breakdown, recent washes |

---

## Features

### Transactions
Record a car wash transaction with:
- **Employee** (washer) assignment — dropdown + quick-select buttons
- **Category** — bicycle, motorcycle, taxi, car, midrange, lorry, carpet
- **Expected price** — auto-set by category, adjustable
- **Cash / M-Pesa** payment split
- **Vacuum & Engine Wash** add-ons
- **Plate number** — shown for all categories except motorcycles (format: e.g. KCA001A)
- **Carpet metadata** — characteristics, receiver employee, optional customer phone for pickup
- **Tip** — auto-detected from overpayment + optional manual tip added on top

After saving, the system calculates commission, shortfall penalties, and adjusts the employee's payable/debt balances immediately.

### Editing & Deleting Transactions
Managers and admins can click **Edit** on any transaction row to modify:
- Washer, category, cash/M-Pesa amounts, plate number, add-ons
- Changes recalculate financials and adjust employee balances in real-time

**Delete** removes the transaction and reverses all balance effects.

### Tips ("Chai")
Managers can log a tip for an employee via the **Log Tip** tab:
- **Add to Wages** — tip amount is credited to the employee's payable balance
- **Give Cash** — tip is logged as a business expense under the "Chai" category

### Expenses
Record operating expenses (soap, water, electricity, rent, salary advances, etc.).

### Debt Repayment
When an employee repays outstanding debt, the amount is deducted from their `debt_balance`.

### Views
- **Day View** — 7-day week selector, click a day to see its transactions
- **Week View** — navigate between weekly periods, shows all transactions in that ISO week

---

## Financial Logic

### Commission Rules
| Condition | Commission |
|-----------|-----------|
| Expected price < 70 Ksh | 0% |
| Motorcycle @ 70 Ksh | 30 Ksh flat |
| Normal Car @ 200 Ksh (no add-ons) | 70 Ksh flat |
| Taxi @ 100 Ksh | 0% |
| Full Package (Wash + Vacuum + Engine Wash) | Floor of 600 Ksh |
| Everything else | 30% of expected price |

### Full Package Floor
If a transaction includes Car Wash + Vacuum + Engine Wash, the expected price is forced to a minimum of 600 Ksh. If the entered price is lower, it's raised to 600 before calculation.

### Shortfall Penalty
If the customer pays less than the expected price (after removing tip):
```
shortfall = expected_price - net_remitted
net_wage = commission - shortfall
```
The employee's commission is reduced by the shortfall. If the shortfall exceeds the commission, the employee goes into debt.

### Zero Remittance (Theft Protection)
If no money is remitted at all (`net_remitted == 0`):
```
net_wage = -expected_price
```
The employee is charged the full expected price as debt.

### Tips
- **Auto-tip**: If total paid > expected price, the difference is isolated as a tip
- **Manual tip**: Any extra tip entered in the form stacks on top of auto-tip
- Tips are paid via WAGES (added to employee payout) or CASH (paid out separately)

### Ledger Routing
| Component | Effect |
|-----------|--------|
| Positive `final_payout` | Added to employee's `payable_balance` |
| Negative `final_payout` | Added to employee's `debt_balance` (absolute value) |
| `net_business_remittance` | Gross revenue for the business |

### Weekly Reset
Every Sunday at 11:59 PM (UTC), employee `payable_balance` resets to zero. `debt_balance` persists.

---

## Database Models

### User
| Field | Type | Notes |
|-------|------|-------|
| id | Integer | PK |
| full_name | String | |
| abbreviation | String | Unique login name |
| hashed_password | String | bcrypt hash |
| role | Enum | admin / manager / employee |
| is_active | Boolean | |
| payable_balance | Float | Wages owed to employee |
| debt_balance | Float | Employee's outstanding debt |

### Transaction
| Field | Type | Notes |
|-------|------|-------|
| id | Integer | PK |
| timestamp | DateTime | |
| washer_id | Integer | FK → users |
| category | Enum | ServiceCategory |
| expected_price | Float | |
| cash_paid | Float | |
| mpesa_paid | Float | |
| mpesa_transaction_id | String | Nullable |
| mpesa_sender_name | String | Nullable |
| manual_tip | Float | |
| tip_method | Enum | cash / wages |
| has_car_wash | Boolean | |
| has_vacuum | Boolean | |
| has_engine_wash | Boolean | |
| plate_number | String | Nullable (all categories except motorcycle) |
| customer_phone | String | Nullable (carpet pickup contact) |
| carpet_characteristics | Text | Nullable |
| receiver_id | Integer | Nullable FK → users |
| total_paid | Float | cash + mpesa |
| isolated_tip | Float | |
| net_business_remittance | Float | |
| shortfall | Float | |
| calculated_commission | Float | |
| net_wage_before_tip | Float | |
| final_payout | Float | |
| week_id | String | ISO year-week |

### Expense
| Field | Type |
|-------|------|
| id, timestamp, description, amount, category, week_id |

### Repayment
| Field | Type |
|-------|------|
| id, timestamp, employee_id (FK), amount, week_id |

---

## API Endpoints

### Auth
- `POST /api/v1/auth/token` — Login, returns JWT

### Users (Admin only)
- `GET /api/v1/auth/users` — List all users
- `POST /api/v1/auth/users` — Create user
- `PUT /api/v1/auth/users/{id}` — Update user
- `DELETE /api/v1/auth/users/{id}` — Delete user

### Transactions
- `GET /api/v1/transactions/` — List (filter by `day`, `week_id`, `washer_id`)
- `POST /api/v1/transactions/` — Create (calculates financials)
- `PUT /api/v1/transactions/{id}` — Update (recalculates, adjusts balances)
- `DELETE /api/v1/transactions/{id}` — Delete (reverses balances)

### Stats
- `GET /api/v1/stats/summary` — Business summary (admin/manager)
- `GET /api/v1/stats/employees` — All employee performance (admin/manager)
- `GET /api/v1/stats/employees/{id}` — Single employee stats (admin/manager)
- `GET /api/v1/stats/me` — Current employee's own stats

### Expenses
- `GET /api/v1/expenses/` — List (admin/manager)
- `POST /api/v1/expenses/` — Create (admin/manager)

### Repayments
- `POST /api/v1/repayments/` — Record debt repayment (admin/manager)

### Tips
- `POST /api/v1/tips/` — Log tip (admin/manager, method: wages/cash)
