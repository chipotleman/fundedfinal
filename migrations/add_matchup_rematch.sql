-- Two-sided rematch handshake state for completed matchups.
-- When both users tap Rematch, a new matchup is created with the same
-- settings and rematch_matchup_id is set on the original.

ALTER TABLE matchups
  ADD COLUMN IF NOT EXISTS user1_rematch_at timestamp,
  ADD COLUMN IF NOT EXISTS user2_rematch_at timestamp,
  ADD COLUMN IF NOT EXISTS user1_rematch_declined_at timestamp,
  ADD COLUMN IF NOT EXISTS user2_rematch_declined_at timestamp,
  ADD COLUMN IF NOT EXISTS rematch_matchup_id varchar;
