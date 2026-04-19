ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS cat_rematch boolean NOT NULL DEFAULT true;
