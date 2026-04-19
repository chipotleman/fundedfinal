-- Track first-deposit bonus match grants on the profile
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_deposit_match_granted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS first_deposit_match_amount DECIMAL(10, 2);
