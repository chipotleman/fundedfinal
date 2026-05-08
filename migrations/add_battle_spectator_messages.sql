-- Spectator chat for live battles. Anyone can read; only authenticated
-- users can post. Messages persist so late-arriving spectators see history.
CREATE TABLE IF NOT EXISTS battle_spectator_messages (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  matchup_id varchar NOT NULL,
  user_id varchar NOT NULL,
  body varchar(300) NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS battle_spectator_messages_matchup_idx
  ON battle_spectator_messages (matchup_id, created_at);
