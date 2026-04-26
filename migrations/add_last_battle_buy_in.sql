-- Persist the friend-row quick-invite "last buy-in" so it follows the user
-- across devices, browsers, and reinstalls instead of living only in the
-- per-device localStorage cache. Stored as { buyIn: number, gameMode: string }.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_battle_buy_in JSONB;
