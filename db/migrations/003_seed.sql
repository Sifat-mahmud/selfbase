-- 003_seed.sql
-- Default seed data — runs after migrations
-- Admin password is injected by install.sh via ADMIN_EMAIL / ADMIN_PASS env vars
-- ─────────────────────────────────────────────────────────────────────────────

-- Default system config
INSERT INTO _selfbase_config (key, value) VALUES
  ('version',             '"0.1.0-alpha"'),
  ('setup_complete',      'false'),
  ('load_shedding',       '{"enabled":true,"shedding_threshold":0.75,"idle_threshold":0.40,"queue_ttl_seconds":300}'),
  ('heartbeat',           '{"interval_seconds":60,"degraded_cpu_threshold":80,"retention_days":90}'),
  ('sync',                '{"version_check_interval_ms":30000}'),
  ('ai',                  '{"enabled":true,"embedding_dimensions":1536}')
ON CONFLICT (key) DO NOTHING;

-- Default admin user
-- Password hash is injected at runtime by the seed script (npm run seed)
-- This placeholder is overwritten immediately after migration
INSERT INTO _selfbase_users (id, email, password_hash, is_admin)
VALUES (
  uuid_generate_v4(),
  current_setting('app.admin_email', true),
  current_setting('app.admin_hash',  true),
  true
)
ON CONFLICT (email) DO NOTHING;
