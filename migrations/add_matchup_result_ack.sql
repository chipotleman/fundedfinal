-- Per-user acknowledgment timestamps for the game-result alerts
-- (won/lost/graded) surfaced in the bell dropdown's Results section.
-- A null value means the user has not yet seen/dismissed the alert for
-- that completed matchup. Cleared by /api/notifications/result-ack.

ALTER TABLE matchups
  ADD COLUMN IF NOT EXISTS user1_result_ack_at timestamp,
  ADD COLUMN IF NOT EXISTS user2_result_ack_at timestamp;

-- Speeds up the "any unacknowledged completed matchup for this user?" lookups
-- run on every /api/notifications request.
CREATE INDEX IF NOT EXISTS matchups_user1_pending_result_idx
  ON matchups (user1_id)
  WHERE status = 'completed' AND user1_result_ack_at IS NULL;

CREATE INDEX IF NOT EXISTS matchups_user2_pending_result_idx
  ON matchups (user2_id)
  WHERE status = 'completed' AND user2_result_ack_at IS NULL;
