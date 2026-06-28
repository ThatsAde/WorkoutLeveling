-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004: Account-based multi-user support
-- Idempotent: safe to run multiple times
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Ensure legacy user id=1 exists (inherits all orphan data)
INSERT OR IGNORE INTO users (id, username, password_hash, created_at)
VALUES (1, 'legacy', '$2y$10$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', datetime('now'));

-- Step 2: Add new columns to users (ALTER TABLE in SQLite only supports ADD COLUMN)
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','moderator','admin'));
ALTER TABLE users ADD COLUMN pfp_url TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN tutorial_completed_at TEXT;
ALTER TABLE users ADD COLUMN settings_json TEXT;
ALTER TABLE users ADD COLUMN banned_at TEXT;
ALTER TABLE users ADD COLUMN ban_reason TEXT;

-- Step 3: Create partial unique index on email (only where email is NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Step 4: Create email verification tokens table
CREATE TABLE IF NOT EXISTS email_verifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT    NOT NULL UNIQUE,
    expires_at TEXT    NOT NULL,
    used_at    TEXT
);

-- Step 5: Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_resets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT    NOT NULL UNIQUE,
    expires_at TEXT    NOT NULL,
    used_at    TEXT
);

-- Step 6: Add user_id to workouts
ALTER TABLE workouts ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
UPDATE workouts SET user_id = 1 WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id);

-- Step 7: Add user_id to sessions
ALTER TABLE sessions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
UPDATE sessions SET user_id = 1 WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Step 8: Add user_id to body_stats
-- First drop the old UNIQUE constraint on recorded_date (we need per-user uniqueness)
-- SQLite can't drop constraints directly, so we recreate the table
CREATE TABLE IF NOT EXISTS body_stats_new (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recorded_date TEXT    NOT NULL,
    weight_kg     REAL,
    body_fat_pct  REAL,
    notes         TEXT,
    UNIQUE(user_id, recorded_date)
);

INSERT OR IGNORE INTO body_stats_new (id, user_id, recorded_date, weight_kg, body_fat_pct, notes)
SELECT id, 1, recorded_date, weight_kg, body_fat_pct, notes FROM body_stats;

DROP TABLE body_stats;
ALTER TABLE body_stats_new RENAME TO body_stats;
CREATE INDEX IF NOT EXISTS idx_body_stats_user ON body_stats(user_id);
