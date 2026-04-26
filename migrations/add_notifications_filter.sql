-- Per-user account preference for the notifications page filter pill,
-- so the chosen filter follows signed-in users across devices.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notifications_filter VARCHAR(20) DEFAULT 'all';

UPDATE profiles
  SET notifications_filter = 'all'
  WHERE notifications_filter IS NULL;
