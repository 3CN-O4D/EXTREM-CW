-- Carpet status flow gains an airing / drying step:
-- received -> washed -> dried (airing in the sun) -> ready -> released.
ALTER TABLE carpets
  ADD COLUMN IF NOT EXISTS dried_at TIMESTAMP WITHOUT TIME ZONE;
