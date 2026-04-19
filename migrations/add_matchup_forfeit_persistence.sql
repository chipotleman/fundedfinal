-- Persist forfeit-win state on matchups so the WonByForfeitModal still
-- surfaces for the winner after a Next.js / SSE server restart.
-- forfeited_by_id is set to the loser's user id when the forfeit endpoint
-- runs; forfeit_acknowledged_at is set when the winner dismisses the modal
-- via /api/battles/forfeit-ack.

ALTER TABLE matchups
  ADD COLUMN IF NOT EXISTS forfeited_by_id varchar,
  ADD COLUMN IF NOT EXISTS forfeit_acknowledged_at timestamp;

-- Speeds up the "any unacknowledged forfeit win for this user?" lookup
-- run on every /api/matchups/current and /api/notifications request.
CREATE INDEX IF NOT EXISTS matchups_pending_forfeit_win_idx
  ON matchups (winner_id)
  WHERE status = 'completed'
    AND forfeited_by_id IS NOT NULL
    AND forfeit_acknowledged_at IS NULL;
