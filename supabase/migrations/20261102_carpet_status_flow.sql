-- Carpet status flow: received -> washed -> ready -> released.
-- Each stage gets its own optional photo; timestamps track when each happened.
ALTER TABLE carpets
  ADD COLUMN IF NOT EXISTS washed_at TIMESTAMP WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS image_washed TEXT,
  ADD COLUMN IF NOT EXISTS image_washed_thumb TEXT,
  ADD COLUMN IF NOT EXISTS image_ready TEXT,
  ADD COLUMN IF NOT EXISTS image_ready_thumb TEXT;
