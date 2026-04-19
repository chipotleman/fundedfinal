ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS cat_invite_outcome boolean NOT NULL DEFAULT true;
