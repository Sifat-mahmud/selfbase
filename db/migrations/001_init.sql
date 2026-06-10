-- 001_init.sql
-- SelfBase core schema — run automatically by install.sh
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ── Internal metadata ─────────────────────────────────────────────────────────

CREATE TABLE _selfbase_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE _selfbase_table_config (
  table_name   TEXT PRIMARY KEY,
  priority     SMALLINT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 4),
  embed_column TEXT,                -- column to auto-embed (nullable)
  embed_model  TEXT,
  rls_enabled  BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- ── Auth ──────────────────────────────────────────────────────────────────────

CREATE TABLE _selfbase_users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  is_admin      BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE _selfbase_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES _selfbase_users(id) ON DELETE CASCADE,
  refresh_token TEXT UNIQUE NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sessions_user_id  ON _selfbase_sessions(user_id);
CREATE INDEX idx_sessions_token    ON _selfbase_sessions(refresh_token);
CREATE INDEX idx_sessions_expiry   ON _selfbase_sessions(expires_at);

CREATE TABLE _selfbase_api_keys (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES _selfbase_users(id) ON DELETE CASCADE,
  key_hash   TEXT UNIQUE NOT NULL,
  label      TEXT,
  last_used  TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Version tracking (local-first sync) ──────────────────────────────────────

CREATE TABLE _selfbase_table_versions (
  table_name   TEXT PRIMARY KEY,
  version_hash TEXT NOT NULL,
  row_count    BIGINT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Function: recompute version hash after any write
CREATE OR REPLACE FUNCTION _selfbase_bump_version(p_table TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO _selfbase_table_versions (table_name, version_hash, row_count, updated_at)
  VALUES (
    p_table,
    encode(digest(p_table || now()::text || random()::text, 'sha256'), 'hex'),
    0,
    now()
  )
  ON CONFLICT (table_name) DO UPDATE SET
    version_hash = encode(digest(p_table || now()::text || random()::text, 'sha256'), 'hex'),
    updated_at   = now();
END;
$$ LANGUAGE plpgsql;

-- ── Priority queue (deferred requests) ───────────────────────────────────────

CREATE TABLE _selfbase_request_queue (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES _selfbase_users(id) ON DELETE CASCADE,
  session_id   TEXT NOT NULL,
  table_name   TEXT NOT NULL,
  query_params JSONB NOT NULL DEFAULT '{}',
  priority     SMALLINT NOT NULL DEFAULT 3,
  queued_at    TIMESTAMPTZ DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  app_version  TEXT
);

CREATE INDEX idx_queue_priority ON _selfbase_request_queue(priority ASC, queued_at ASC);
CREATE INDEX idx_queue_expires  ON _selfbase_request_queue(expires_at);
CREATE INDEX idx_queue_session  ON _selfbase_request_queue(session_id);

-- Auto-purge expired entries
CREATE OR REPLACE FUNCTION _selfbase_purge_queue()
RETURNS void AS $$
BEGIN
  DELETE FROM _selfbase_request_queue WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- ── Heartbeat & monitoring ────────────────────────────────────────────────────

CREATE TABLE _selfbase_heartbeat (
  recorded_at   TIMESTAMPTZ PRIMARY KEY,
  cpu_total     SMALLINT NOT NULL,
  cpu_scraper   SMALLINT NOT NULL DEFAULT 0,
  cpu_api       SMALLINT NOT NULL DEFAULT 0,
  cpu_functions SMALLINT NOT NULL DEFAULT 0,
  ram_used_mb   INTEGER NOT NULL,
  interval_sec  SMALLINT NOT NULL DEFAULT 60,
  is_degraded   BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_heartbeat_time ON _selfbase_heartbeat(recorded_at DESC);

CREATE TABLE _selfbase_table_calls (
  window_start   TIMESTAMPTZ NOT NULL,
  table_name     TEXT NOT NULL,
  call_count     INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (window_start, table_name)
);

CREATE INDEX idx_table_calls_time  ON _selfbase_table_calls(window_start DESC);
CREATE INDEX idx_table_calls_table ON _selfbase_table_calls(table_name);

-- ── Ingestion (Pipeline Studio) ───────────────────────────────────────────────

CREATE TABLE _selfbase_sources (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  source_type      TEXT NOT NULL CHECK (source_type IN ('rest', 'rss', 'scraper', 'websocket')),
  url              TEXT NOT NULL,
  auth_header      TEXT,                 -- encrypted at app layer
  json_path        TEXT,                 -- e.g. "data.stocks"
  target_table     TEXT NOT NULL,
  column_map       JSONB NOT NULL DEFAULT '[]',
  on_conflict      TEXT NOT NULL DEFAULT 'upsert' CHECK (on_conflict IN ('upsert','insert','replace')),
  interval_seconds INTEGER NOT NULL DEFAULT 60,
  cron_expression  TEXT,
  active_window    TEXT,                 -- e.g. "10:00-14:30" or null for always
  is_active        BOOLEAN NOT NULL DEFAULT false,
  last_fetched_at  TIMESTAMPTZ,
  last_error       TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE _selfbase_source_errors (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id   UUID NOT NULL REFERENCES _selfbase_sources(id) ON DELETE CASCADE,
  error_type  TEXT NOT NULL,            -- 'fetch' | 'transform' | 'validate' | 'upsert'
  error_msg   TEXT NOT NULL,
  raw_payload JSONB,
  occurred_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_source_errors_source ON _selfbase_source_errors(source_id, occurred_at DESC);

-- ── Storage registry ──────────────────────────────────────────────────────────

CREATE TABLE _selfbase_files (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES _selfbase_users(id) ON DELETE SET NULL,
  bucket       TEXT NOT NULL,
  path         TEXT NOT NULL,
  filename     TEXT NOT NULL,
  mime_type    TEXT,
  size_bytes   BIGINT NOT NULL DEFAULT 0,
  is_public    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (bucket, path)
);

-- ── Serverless functions registry ─────────────────────────────────────────────

CREATE TABLE _selfbase_functions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT UNIQUE NOT NULL,
  runtime      TEXT NOT NULL DEFAULT 'deno',
  code         TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'http' CHECK (trigger_type IN ('http','schedule','db_event')),
  trigger_conf JSONB,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- ── RLS policies registry ─────────────────────────────────────────────────────

CREATE TABLE _selfbase_rls_policies (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  policy     TEXT NOT NULL,            -- SQL expression using auth.uid()
  operation  TEXT NOT NULL DEFAULT 'ALL' CHECK (operation IN ('ALL','SELECT','INSERT','UPDATE','DELETE')),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
