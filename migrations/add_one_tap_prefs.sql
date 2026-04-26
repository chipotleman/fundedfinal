-- Persist the homepage "Play Now" one-tap card defaults (preferred buy-in
-- and game mode) so they follow signed-in users across devices, browsers,
-- and reinstalls instead of living only in the per-device localStorage
-- cache (`piks:onetap-prefs:v1`). Stored as { buyIn: number, gameMode: string }.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS one_tap_prefs JSONB;
