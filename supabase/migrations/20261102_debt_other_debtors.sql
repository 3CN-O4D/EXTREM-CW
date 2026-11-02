-- Debts may belong to an employee (deducted from Sunday wages) or to an
-- "other" (specified) debtor that is tracked until cleared.
ALTER TABLE debts ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS other_name TEXT;
