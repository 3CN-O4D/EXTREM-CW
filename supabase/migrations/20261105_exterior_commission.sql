-- Exterior wash is an exterior-only option for cars: Ksh 150 instead of the
-- full Ksh 200 car wash. The washer earns 33.3334% of 150, which rounds to
-- Ksh 50.
UPDATE prices
SET min_price = 150,
    max_price = 150,
    commission_percent = 33.3334,
    updated_at = NOW()
WHERE category = 'exterior';
