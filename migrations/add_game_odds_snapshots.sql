-- Per-game odds snapshots powering the Kalshi-style live odds chart on
-- /game/[id]. Captured fire-and-forget from pages/api/games/index.js
-- whenever the public games cache refreshes; reads happen via
-- /api/games/[id]/odds-history.
CREATE TABLE IF NOT EXISTS "game_odds_snapshots" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "game_id" varchar(191) NOT NULL,
  "sport" varchar(100),
  "captured_at" timestamp NOT NULL DEFAULT now(),
  "home_ml" integer,
  "away_ml" integer,
  "total_line" numeric(8, 2),
  "home_spread" numeric(8, 2),
  "away_spread" numeric(8, 2),
  "source" varchar(64)
);

CREATE INDEX IF NOT EXISTS "game_odds_snapshots_game_captured_idx"
  ON "game_odds_snapshots" ("game_id", "captured_at");
CREATE INDEX IF NOT EXISTS "game_odds_snapshots_captured_at_idx"
  ON "game_odds_snapshots" ("captured_at");
