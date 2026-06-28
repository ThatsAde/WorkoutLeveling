-- ─────────────────────────────────────────
-- Reference / Lookup Tables
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS muscles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    group_name  TEXT    NOT NULL,
    body_side   TEXT    NOT NULL DEFAULT 'bilateral'
                        CHECK(body_side IN ('left','right','bilateral'))
);

CREATE TABLE IF NOT EXISTS movement_types (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT    NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS workout_categories (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL UNIQUE
);

-- ─────────────────────────────────────────
-- Exercise Library
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exercises (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT    NOT NULL UNIQUE,
    movement_type_id INTEGER NOT NULL REFERENCES movement_types(id),
    is_weighted      INTEGER NOT NULL DEFAULT 0 CHECK(is_weighted IN (0,1)),
    default_weight   REAL,
    difficulty       INTEGER NOT NULL DEFAULT 3
                     CHECK(difficulty BETWEEN 1 AND 5),
    description      TEXT,
    video_url        TEXT,
    image_url        TEXT,
    is_timed         INTEGER NOT NULL DEFAULT 0 CHECK(is_timed IN (0,1)),
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exercise_muscles (
    exercise_id  INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    muscle_id    INTEGER NOT NULL REFERENCES muscles(id),
    role         TEXT    NOT NULL CHECK(role IN ('primary','secondary')),
    PRIMARY KEY (exercise_id, muscle_id)
);

CREATE TABLE IF NOT EXISTS exercise_tendons (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id  INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    tendon_name  TEXT    NOT NULL
);

-- ─────────────────────────────────────────
-- Workout Templates
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workouts (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    name                    TEXT    NOT NULL,
    category_id             INTEGER REFERENCES workout_categories(id),
    description             TEXT,
    estimated_duration_min  INTEGER,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workout_exercises (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id    INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id   INTEGER NOT NULL REFERENCES exercises(id),
    position      INTEGER NOT NULL,
    sets          INTEGER NOT NULL DEFAULT 3,
    target_reps   INTEGER,
    target_time_s INTEGER,
    rest_s        INTEGER NOT NULL DEFAULT 90,
    notes         TEXT
);

-- ─────────────────────────────────────────
-- Session Logging
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id   INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
    name         TEXT,
    started_at   TEXT    NOT NULL,
    ended_at     TEXT,
    notes        TEXT,
    overall_rpe  INTEGER CHECK(overall_rpe BETWEEN 1 AND 10),
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS session_sets (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    exercise_id  INTEGER NOT NULL REFERENCES exercises(id),
    set_number   INTEGER NOT NULL,
    reps         INTEGER,
    duration_s   INTEGER,
    weight       REAL,
    rpe          INTEGER CHECK(rpe BETWEEN 1 AND 10),
    notes        TEXT,
    completed    INTEGER NOT NULL DEFAULT 1 CHECK(completed IN (0,1))
);

-- ─────────────────────────────────────────
-- Body Stats
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS body_stats (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    recorded_date TEXT  NOT NULL UNIQUE,
    weight_kg     REAL,
    body_fat_pct  REAL,
    notes         TEXT
);

-- ─────────────────────────────────────────
-- Auth
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT  NOT NULL UNIQUE,
    password_hash TEXT  NOT NULL,
    created_at    TEXT  NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_session_sets_session  ON session_sets(session_id);
CREATE INDEX IF NOT EXISTS idx_session_sets_exercise ON session_sets(exercise_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started      ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_wid ON workout_exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_exercise_muscles_eid  ON exercise_muscles(exercise_id);
