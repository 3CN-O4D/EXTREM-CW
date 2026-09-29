-- Weekly settlement, tips log and client debts for EXTREME-CW.
-- Concept: employees are paid every Sunday evening. Settlement covers that
-- week's wages against every open employee debt (debts are keyed any day and
-- cleared on payday); any unused-debt remainder carries to the next week.
-- Every Monday starts fresh (payable_balance reset to zero after settlement).

-- Employee shortfall debts produced automatically by transactions (when a
-- shortfall exceeds the worker's commission) now link back to their
-- transaction. Manual debts keep transaction_id NULL.
ALTER TABLE debts ADD COLUMN transaction_id INTEGER;

-- Tips log: every tip, cash or wages, is recorded. WAGES tips accrue to the
-- weekly payable used by settlement (the cash path also records a Chai expense).
CREATE TABLE tips (
    id SERIAL NOT NULL,
    timestamp TIMESTAMP WITHOUT TIME ZONE,
    employee_id INTEGER NOT NULL,
    amount FLOAT NOT NULL,
    method tipmethod NOT NULL,
    week_id VARCHAR,
    notes TEXT,
    PRIMARY KEY (id),
    FOREIGN KEY(employee_id) REFERENCES users (id)
);
CREATE INDEX ix_tips_week_id ON tips (week_id);
CREATE INDEX ix_tips_employee_id ON tips (employee_id);

-- Client debts: money that some clients carry forward. Keyed/cleared any day,
-- completely separate from the employee Sunday settlement.
CREATE TABLE client_debts (
    id SERIAL NOT NULL,
    client_name VARCHAR NOT NULL,
    customer_phone VARCHAR,
    description TEXT,
    amount FLOAT NOT NULL,
    paid FLOAT NOT NULL DEFAULT 0,
    date TIMESTAMP WITHOUT TIME ZONE,
    paid_date TIMESTAMP WITHOUT TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    PRIMARY KEY (id)
);
CREATE INDEX ix_client_debts_id ON client_debts (id);