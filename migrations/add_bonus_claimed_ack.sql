-- Server-side acknowledgement timestamp for the "Bonus claimed" celebration
-- popup (BonusClaimedCelebration). Previously gated only by per-user
-- localStorage which meant a user signing in on a second device within the
-- 24h freshness window would see the celebration again. Persisting the
-- dismissal here guarantees it's shown at most once per user across devices.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bonus_claimed_acknowledged_at timestamp;
