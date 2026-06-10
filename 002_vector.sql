-- 002_vector.sql
-- SelfBase AI layer — vector store and embedding metadata
-- Requires pgvector extension (enabled in 001_init.sql)
-- ─────────────────────────────────────────────────────────────────────────────

-- Embedding jobs queue (async auto-embed on write)
CREATE TABLE _selfbase_embed_jobs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name  TEXT NOT NULL,
  row_id      TEXT NOT NULL,
  column_name TEXT NOT NULL,
  content     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','error')),
  error_msg   TEXT,
  queued_at   TIMESTAMPTZ DEFAULT now(),
  done_at     TIMESTAMPTZ
);

CREATE INDEX idx_embed_jobs_pending ON _selfbase_embed_jobs(status, queued_at)
  WHERE status = 'pending';

-- Embedding store — one row per embedded text chunk
CREATE TABLE _selfbase_embeddings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name  TEXT NOT NULL,
  row_id      TEXT NOT NULL,
  column_name TEXT NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(1536),            -- dimensions set by configured model
  model       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (table_name, row_id, column_name)
);

-- HNSW index for fast approximate nearest-neighbour search
CREATE INDEX idx_embeddings_hnsw ON _selfbase_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_embeddings_table ON _selfbase_embeddings(table_name, row_id);

-- LLM response cache (semantic dedup)
CREATE TABLE _selfbase_llm_cache (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_hash     TEXT NOT NULL,        -- SHA-256 of prompt for exact match
  prompt_embedding vector(1536),        -- for semantic similarity match
  model           TEXT NOT NULL,
  response        TEXT NOT NULL,
  tokens_used     INTEGER,
  cached_at       TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  hit_count       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_llm_cache_hash    ON _selfbase_llm_cache(prompt_hash);
CREATE INDEX idx_llm_cache_hnsw    ON _selfbase_llm_cache
  USING hnsw (prompt_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_llm_cache_expires ON _selfbase_llm_cache(expires_at)
  WHERE expires_at IS NOT NULL;

-- LLM usage tracking (cost monitoring)
CREATE TABLE _selfbase_llm_usage (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES _selfbase_users(id) ON DELETE SET NULL,
  provider     TEXT NOT NULL,
  model        TEXT NOT NULL,
  prompt_tokens   INTEGER NOT NULL DEFAULT 0,
  response_tokens INTEGER NOT NULL DEFAULT 0,
  cache_hit    BOOLEAN NOT NULL DEFAULT false,
  called_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_llm_usage_user ON _selfbase_llm_usage(user_id, called_at DESC);
CREATE INDEX idx_llm_usage_time ON _selfbase_llm_usage(called_at DESC);

-- AI guardrail rules
CREATE TABLE _selfbase_ai_rules (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  scope       TEXT NOT NULL,           -- 'global' | 'table:tablename' | 'function:fname'
  rule_type   TEXT NOT NULL CHECK (rule_type IN ('allowlist','blocklist','regex','llm_judge')),
  rule_value  TEXT NOT NULL,
  action      TEXT NOT NULL DEFAULT 'block' CHECK (action IN ('block','flag','replace')),
  replace_with TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Convenience function: semantic search
CREATE OR REPLACE FUNCTION _selfbase_semantic_search(
  p_table     TEXT,
  p_column    TEXT,
  p_query_vec vector(1536),
  p_limit     INT DEFAULT 10,
  p_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  row_id     TEXT,
  content    TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.row_id,
    e.content,
    1 - (e.embedding <=> p_query_vec) AS similarity
  FROM _selfbase_embeddings e
  WHERE e.table_name = p_table
    AND e.column_name = p_column
    AND 1 - (e.embedding <=> p_query_vec) >= p_threshold
  ORDER BY e.embedding <=> p_query_vec
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
