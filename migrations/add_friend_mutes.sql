CREATE TABLE IF NOT EXISTS friend_mutes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  muter_id varchar NOT NULL,
  muted_id varchar NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS friend_mutes_muter_id_idx ON friend_mutes (muter_id);
CREATE UNIQUE INDEX IF NOT EXISTS friend_mutes_unique_idx ON friend_mutes (muter_id, muted_id);
