CREATE TABLE IF NOT EXISTS "password_reset_rate_limits" (
  "key" varchar(320) PRIMARY KEY,
  "count" integer NOT NULL DEFAULT 0,
  "reset_at" timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS "password_reset_rate_limits_reset_at_idx" ON "password_reset_rate_limits" ("reset_at");
