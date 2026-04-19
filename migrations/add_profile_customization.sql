-- Profile customization: banner, favorite teams, avatar frames
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS favorite_teams JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS equipped_frame VARCHAR(50),
  ADD COLUMN IF NOT EXISTS unlocked_frames JSONB DEFAULT '[]'::jsonb;

UPDATE profiles
  SET favorite_teams = '[]'::jsonb
  WHERE favorite_teams IS NULL;

UPDATE profiles
  SET unlocked_frames = '[]'::jsonb
  WHERE unlocked_frames IS NULL;
