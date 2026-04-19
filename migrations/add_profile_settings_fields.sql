-- Settings page additions: social handles + odds format preference
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR(100),
  ADD COLUMN IF NOT EXISTS facebook_url TEXT,
  ADD COLUMN IF NOT EXISTS odds_format VARCHAR(20) DEFAULT 'american',
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS privacy_prefs JSONB DEFAULT '{}'::jsonb;

UPDATE profiles
  SET odds_format = 'american'
  WHERE odds_format IS NULL;
