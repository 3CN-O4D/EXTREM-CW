-- EXTREME-CW initial schema for Supabase Postgres
CREATE TYPE userrole AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE');
CREATE TYPE servicecategory AS ENUM ('BICYCLE', 'MOTORCYCLE', 'TAXI', 'CAR', 'MIDRANGE', 'LORRY', 'CARPET', 'OTHER');
CREATE TYPE tipmethod AS ENUM ('CASH', 'WAGES');

CREATE TABLE users (
	id SERIAL NOT NULL, 
	full_name VARCHAR, 
	abbreviation VARCHAR NOT NULL, 
	hashed_password VARCHAR NOT NULL, 
	role userrole, 
	is_active BOOLEAN, 
	payable_balance FLOAT, 
	debt_balance FLOAT, 
	PRIMARY KEY (id)
);

CREATE TABLE weekly_logs (
	id SERIAL NOT NULL, 
	week_id VARCHAR, 
	start_date TIMESTAMP WITHOUT TIME ZONE, 
	end_date TIMESTAMP WITHOUT TIME ZONE, 
	total_revenue FLOAT, 
	total_expenses FLOAT, 
	total_labor_expense FLOAT, 
	total_profit FLOAT, 
	data_json TEXT, 
	PRIMARY KEY (id)
);

CREATE TABLE carpets (
	id SERIAL NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	receiver_id INTEGER NOT NULL, 
	characteristics TEXT, 
	client_name VARCHAR, 
	customer_phone VARCHAR, 
	image_data TEXT, 
	expected_price FLOAT, 
	cash_paid FLOAT, 
	mpesa_paid FLOAT, 
	is_washed BOOLEAN, 
	status VARCHAR, 
	released_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(receiver_id) REFERENCES users (id)
);

CREATE TABLE debts (
	id SERIAL NOT NULL, 
	employee_id INTEGER NOT NULL, 
	amount FLOAT NOT NULL, 
	service VARCHAR, 
	date TIMESTAMP WITHOUT TIME ZONE, 
	paid FLOAT, 
	paid_date TIMESTAMP WITHOUT TIME ZONE, 
	notes TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(employee_id) REFERENCES users (id)
);

CREATE TABLE repayments (
	id SERIAL NOT NULL, 
	timestamp TIMESTAMP WITHOUT TIME ZONE, 
	employee_id INTEGER, 
	amount FLOAT, 
	week_id VARCHAR, 
	PRIMARY KEY (id), 
	FOREIGN KEY(employee_id) REFERENCES users (id)
);

CREATE TABLE transactions (
	id SERIAL NOT NULL, 
	timestamp TIMESTAMP WITHOUT TIME ZONE, 
	washer_id INTEGER, 
	category servicecategory, 
	expected_price FLOAT, 
	cash_paid FLOAT, 
	mpesa_paid FLOAT, 
	mpesa_transaction_id VARCHAR, 
	mpesa_sender_name VARCHAR, 
	manual_tip FLOAT, 
	tip_method tipmethod, 
	misc_amount FLOAT, 
	misc_description VARCHAR, 
	has_car_wash BOOLEAN, 
	has_vacuum BOOLEAN, 
	has_engine_wash BOOLEAN, 
	plate_number VARCHAR, 
	customer_phone VARCHAR, 
	custom_category VARCHAR, 
	carpet_characteristics TEXT, 
	receiver_id INTEGER, 
	total_paid FLOAT, 
	isolated_tip FLOAT, 
	net_business_remittance FLOAT, 
	shortfall FLOAT, 
	calculated_commission FLOAT, 
	net_wage_before_tip FLOAT, 
	final_payout FLOAT, 
	week_id VARCHAR, 
	PRIMARY KEY (id), 
	FOREIGN KEY(washer_id) REFERENCES users (id), 
	FOREIGN KEY(receiver_id) REFERENCES users (id)
);

CREATE TABLE expenses (
	id SERIAL NOT NULL, 
	timestamp TIMESTAMP WITHOUT TIME ZONE, 
	description VARCHAR, 
	amount FLOAT, 
	category VARCHAR, 
	week_id VARCHAR, 
	transaction_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(transaction_id) REFERENCES transactions (id)
);

CREATE INDEX ix_users_full_name ON users (full_name);
CREATE INDEX ix_users_id ON users (id);
CREATE UNIQUE INDEX ix_users_abbreviation ON users (abbreviation);
CREATE INDEX ix_weekly_logs_id ON weekly_logs (id);
CREATE UNIQUE INDEX ix_weekly_logs_week_id ON weekly_logs (week_id);
CREATE INDEX ix_carpets_id ON carpets (id);
CREATE INDEX ix_debts_id ON debts (id);
CREATE INDEX ix_repayments_week_id ON repayments (week_id);
CREATE INDEX ix_repayments_id ON repayments (id);
CREATE INDEX ix_transactions_id ON transactions (id);
CREATE INDEX ix_transactions_week_id ON transactions (week_id);
CREATE INDEX ix_expenses_id ON expenses (id);
CREATE INDEX ix_expenses_week_id ON expenses (week_id);

-- Seed users
INSERT INTO users (full_name, abbreviation, hashed_password, role, is_active, payable_balance, debt_balance) VALUES ('Business Manager', 'manager', '$2b$12$bboj.EVG/.rdn6AUjLK/Y.GyUeDQB8au/ZSYJXdw2JUVgYJY905u2', 'MANAGER', true, 0.0, 0.0);
INSERT INTO users (full_name, abbreviation, hashed_password, role, is_active, payable_balance, debt_balance) VALUES ('Administrator', 'admin', '$2b$12$rKDZskEnGNhF1uryv.tJ7uvZBJ1F9tCjAzbsZK4SHIQsKumiM1.Te', 'ADMIN', true, 0.0, 0.0);
INSERT INTO users (full_name, abbreviation, hashed_password, role, is_active, payable_balance, debt_balance) VALUES ('Jeophrey', 'J', '$2b$12$BeEZrQBB8ftYGuFrL4pEj.gNYBbs80Ks6FxRw9zeK95Tq8l1vveS6', 'EMPLOYEE', true, 0.0, 0.0);
INSERT INTO users (full_name, abbreviation, hashed_password, role, is_active, payable_balance, debt_balance) VALUES ('Abel', 'A', '$2b$12$keVqnUeRrQnQCQAVHu351evbBvDbhu/l6yVE5od0eoFn0Mxki70RG', 'EMPLOYEE', true, 0.0, 0.0);
INSERT INTO users (full_name, abbreviation, hashed_password, role, is_active, payable_balance, debt_balance) VALUES ('Levis', 'L', '$2b$12$YAMOhkaaEEWQg1HQ.moL4uv0duK.0e/xeiIRXMHtZ31HdOYuAuTyS', 'EMPLOYEE', true, 0.0, 0.0);
INSERT INTO users (full_name, abbreviation, hashed_password, role, is_active, payable_balance, debt_balance) VALUES ('Derrick', 'D', '$2b$12$mnJSu.z.hZWsqHKljg4CfeVdxkwuxqZV52Hp4/GZxyen1kpWIJ6si', 'EMPLOYEE', true, 0.0, 0.0);
