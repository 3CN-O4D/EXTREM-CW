-- Vehicles arrive and are logged by an employee without payment; the money is
-- settled later (cash + mpesa mix). If not settled within 24h the expected
-- price becomes a shortfall debt for the employee who logged the arrival.

CREATE TABLE vehicle_arrivals (
	id SERIAL NOT NULL,
	created_at TIMESTAMP WITHOUT TIME ZONE,
	plate_number VARCHAR NOT NULL,
	category VARCHAR NOT NULL,
	expected_price FLOAT,
	submitter_id INTEGER NOT NULL,
	washer_id INTEGER,
	cash_paid FLOAT DEFAULT 0,
	mpesa_paid FLOAT DEFAULT 0,
	status VARCHAR DEFAULT 'pending', -- pending | settled | expired
	debt_id INTEGER,
	transaction_id INTEGER,
	settled_at TIMESTAMP WITHOUT TIME ZONE,
	PRIMARY KEY (id),
	FOREIGN KEY(submitter_id) REFERENCES users (id),
	FOREIGN KEY(washer_id) REFERENCES users (id)
);

-- Carpets: the operator who received the carpet may be picked later, and the
-- employee who logged the arrival is recorded so ownership is never lost.
ALTER TABLE carpets ALTER COLUMN receiver_id DROP NOT NULL;
ALTER TABLE carpets ADD COLUMN IF NOT EXISTS submitter_id INTEGER;