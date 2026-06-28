-- ─────────────────────────────────────────
-- Auth Tokens (token-based auth for mobile/PWA)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auth_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT    NOT NULL UNIQUE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT    NOT NULL DEFAULT (datetime('now', '+30 days'))
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_token   ON auth_tokens(token);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id);
