-- ─────────────────────────────────────────────────────────────────────────
-- MCP access tokens
-- ─────────────────────────────────────────────────────────────────────────
--
-- Applied by hand rather than via `npm run db:push`. Drizzle's push goes
-- interactive when it detects pre-existing drift in this database (see
-- .agents/memory/db-push-drift.md), so new tables are created with direct
-- SQL and the Drizzle schema is kept in sync by hand.
--
-- Run with:
--   psql "$DATABASE_URL" -f scripts/create-mcp-tables.sql
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS user_api_tokens (
  id            SERIAL PRIMARY KEY,
  user_id       VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  token_prefix  VARCHAR(8) NOT NULL,
  token_hash    VARCHAR(64) NOT NULL,
  last4         VARCHAR(4) NOT NULL,
  scopes        JSONB NOT NULL DEFAULT '["read"]'::jsonb,
  last_used_at  TIMESTAMP,
  expires_at    TIMESTAMP,
  revoked_at    TIMESTAMP,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Verification path: single-row lookup by the non-secret prefix, then a
-- constant-time comparison of the hash. Never a scan.
CREATE INDEX IF NOT EXISTS "IDX_user_api_tokens_prefix"
  ON user_api_tokens (token_prefix);

CREATE INDEX IF NOT EXISTS "IDX_user_api_tokens_user"
  ON user_api_tokens (user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- MCP tool-call audit log
-- ─────────────────────────────────────────────────────────────────────────
--
-- Tool NAME only. Never arguments, never results — those would copy
-- transcript text and customer quotes into a second table with its own
-- retention story, defeating the purpose.

CREATE TABLE IF NOT EXISTS mcp_tool_calls (
  id          SERIAL PRIMARY KEY,
  user_id     VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_id    INTEGER,
  token_name  TEXT,
  tool_name   TEXT NOT NULL,
  method      TEXT NOT NULL DEFAULT 'tools/call',
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_mcp_tool_calls_user_time"
  ON mcp_tool_calls (user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- OAuth 2.1 for MCP
-- ─────────────────────────────────────────────────────────────────────────

-- Tokens issued by the OAuth flow live in user_api_tokens with origin='oauth',
-- so verifyToken / guards / audit log stay unchanged. Add the columns the
-- OAuth path needs. Idempotent.
ALTER TABLE user_api_tokens
  ADD COLUMN IF NOT EXISTS origin             TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS oauth_client_id    VARCHAR,
  ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS "IDX_user_api_tokens_refresh"
  ON user_api_tokens (refresh_token_hash);

-- Dynamically-registered MCP clients (RFC 7591). Public clients (PKCE), so no
-- client secret is stored.
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id     VARCHAR PRIMARY KEY,
  client_name   TEXT,
  redirect_uris JSONB NOT NULL DEFAULT '[]'::jsonb,
  grant_types   JSONB NOT NULL DEFAULT '["authorization_code","refresh_token"]'::jsonb,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Short-lived, single-use authorization codes with the PKCE challenge.
CREATE TABLE IF NOT EXISTS oauth_auth_codes (
  id                    SERIAL PRIMARY KEY,
  code_hash             VARCHAR(64) NOT NULL,
  client_id             VARCHAR NOT NULL,
  user_id               VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redirect_uri          TEXT NOT NULL,
  code_challenge        TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  scope                 TEXT NOT NULL DEFAULT 'read',
  resource              TEXT,
  expires_at            TIMESTAMP NOT NULL,
  consumed_at           TIMESTAMP,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_oauth_auth_codes_hash"
  ON oauth_auth_codes (code_hash);
