-- Configurable pricing per service category.
-- min_price: below this, shortfall starts being deducted from wages.
-- max_price: the expected price shown in the Day Sheet.
-- commission_percent: percentage of max_price paid as commission.
CREATE TABLE IF NOT EXISTS prices (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) UNIQUE NOT NULL,
  min_price NUMERIC NOT NULL DEFAULT 0,
  max_price NUMERIC NOT NULL DEFAULT 0,
  commission_percent NUMERIC NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Seed defaults matching current commission/pricing rules.
INSERT INTO prices (category, min_price, max_price, commission_percent) VALUES
  ('bicycle', 50, 50, 0),
  ('motorcycle', 50, 70, 43),
  ('taxi', 150, 150, 33),
  ('car', 200, 200, 35),
  ('midrange', 300, 300, 30),
  ('lorry', 500, 500, 30),
  ('carpet', 300, 300, 30),
  ('vacuum', 200, 300, 30),
  ('engine', 200, 300, 30),
  ('exterior', 300, 500, 30),
  ('other', 0, 0, 0)
ON CONFLICT (category) DO NOTHING;
