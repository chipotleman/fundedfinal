-- Audit log for sensitive admin actions (e.g., first-deposit match grants/revokes)
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id VARCHAR,
  admin_email VARCHAR(255),
  admin_type VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  target_user_id VARCHAR,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_audit_log_target_user_id_idx ON admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON admin_audit_log(created_at);
