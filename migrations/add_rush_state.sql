-- Rush mini-game state: voting picks, chosen live game, generated questions,
-- per-player answers, scoring, and tiebreak times. Stored as JSONB on the
-- matchup so the entire mini-game lives alongside the matchup row that the
-- existing settlement / forfeit / SSE plumbing already understands.

ALTER TABLE matchups
  ADD COLUMN IF NOT EXISTS rush_state jsonb;
