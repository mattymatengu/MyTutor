-- My Tutor (NUST) - relational schema (SQLite)
-- Run automatically by server/db.js on first start, or manually:
--   sqlite3 database/mytutor.db < database/schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL CHECK (role IN ('student', 'tutor', 'admin')),
    -- tutors start as 'pending' until an admin approves them
    status        TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended')),
    student_no    TEXT,
    qualification TEXT,
    bio           TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS modules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    department  TEXT NOT NULL,
    level       INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 4),
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Which modules a tutor wants to teach (admin approves each one)
CREATE TABLE IF NOT EXISTS tutor_modules (
    tutor_id  INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    grade     TEXT,
    status    TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    PRIMARY KEY (tutor_id, module_id)
);

-- A student's request for tutoring in a module
CREATE TABLE IF NOT EXISTS applications (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id   INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    module_id    INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    tutor_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    current_level TEXT   NOT NULL,
    availability TEXT    NOT NULL,
    message      TEXT    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS materials (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id   INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    tutor_id    INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    title       TEXT    NOT NULL,
    description TEXT,
    kind        TEXT    NOT NULL DEFAULT 'notes' CHECK (kind IN ('notes', 'slides', 'past_paper', 'video', 'other')),
    file_path   TEXT,           -- uploaded file (relative to /uploads)
    link_url    TEXT,           -- or an external link (e.g. a video)
    -- public: any logged-in student; students_only: only tutor's approved students
    visibility  TEXT    NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'students_only')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tutoring_sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id    INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    tutor_id     INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    title        TEXT    NOT NULL,
    starts_at    TEXT    NOT NULL,   -- 'YYYY-MM-DDTHH:MM'
    duration_min INTEGER NOT NULL DEFAULT 60 CHECK (duration_min BETWEEN 15 AND 240),
    venue        TEXT    NOT NULL,   -- room or meeting link
    capacity     INTEGER NOT NULL DEFAULT 20 CHECK (capacity BETWEEN 1 AND 500),
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS session_rsvps (
    session_id INTEGER NOT NULL REFERENCES tutoring_sessions(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES users(id)             ON DELETE CASCADE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (session_id, student_id)
);

CREATE TABLE IF NOT EXISTS reviews (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    tutor_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (tutor_id, student_id)
);

CREATE TABLE IF NOT EXISTS contact_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    subject    TEXT NOT NULL,
    message    TEXT NOT NULL,
    resolved   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- "Forgot password": a registered user asks and a random one-time link (valid 30 minutes) is created automatically.
-- Only a SHA-256 hash of the token is stored, never the token itself.
CREATE TABLE IF NOT EXISTS password_resets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status     TEXT    NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'issued', 'done')),
    token_hash TEXT,
    expires_at TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_app_student  ON applications(student_id);
CREATE INDEX IF NOT EXISTS idx_app_tutor    ON applications(tutor_id);
CREATE INDEX IF NOT EXISTS idx_mat_module   ON materials(module_id);
CREATE INDEX IF NOT EXISTS idx_sess_module  ON tutoring_sessions(module_id);
