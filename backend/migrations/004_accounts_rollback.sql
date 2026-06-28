-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback 004: Remove account-based multi-user support
-- WARNING: This will DESTROY user data added after migration 004
-- ─────────────────────────────────────────────────────────────────────────────

-- Restore body_stats without user_id
CREATE TABLE body_stats_old (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    recorded_date TEXT  NOT NULL UNIQUE,
    weight_kg     REAL,
    body_fat_pct  REAL,
    notes         TEXT
);
INSERT OR IGNORE INTO body_stats_old (id, recorded_date, weight_kg, body_fat_pct, notes)
SELECT id, recorded_date, weight_kg, body_fat_pct, notes FROM body_stats WHERE user_id = 1;
DROP TABLE body_stats;
ALTER TABLE body_stats_old RENAME TO body_stats;

-- Drop new tables
DROP TABLE IF EXISTS email_verifications;
DROP TABLE IF EXISTS password_resets;

-- Note: SQLite does not support DROP COLUMN. To fully rollback, restore from backup.
-- Columns added (email, email_verified_at, role, pfp_url, bio, tutorial_completed_at, settings_json,
--                workouts.user_id, sessions.user_id) cannot be removed without full table recreation.
