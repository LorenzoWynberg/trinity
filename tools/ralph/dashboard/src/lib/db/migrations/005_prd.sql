-- PRD data migration: Move from JSON files to SQLite

-- Version metadata
CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  title TEXT,
  short_title TEXT,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Phases per version
CREATE TABLE IF NOT EXISTS phases (
  version_id TEXT NOT NULL,
  id INTEGER NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (version_id, id),
  FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE
);

-- Epics per version
CREATE TABLE IF NOT EXISTS epics (
  version_id TEXT NOT NULL,
  phase_id INTEGER NOT NULL,
  id INTEGER NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (version_id, phase_id, id),
  FOREIGN KEY (version_id, phase_id) REFERENCES phases(version_id, id) ON DELETE CASCADE
);

-- Stories
CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  phase INTEGER NOT NULL,
  epic INTEGER NOT NULL,
  story_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  intent TEXT,
  description TEXT,
  acceptance TEXT,
  depends_on TEXT,
  tags TEXT,
  passes INTEGER DEFAULT 0,
  merged INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  branch TEXT,
  pr_url TEXT,
  merge_commit TEXT,
  external_deps TEXT,
  external_deps_report TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_stories_version ON stories(version_id);
CREATE INDEX IF NOT EXISTS idx_stories_phase_epic ON stories(version_id, phase, epic);
CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(passes, merged, skipped);

-- Execution state (single row)
CREATE TABLE IF NOT EXISTS run_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_story TEXT,
  status TEXT DEFAULT 'idle',
  branch TEXT,
  attempts INTEGER DEFAULT 0,
  pr_url TEXT,
  last_completed TEXT,
  last_error TEXT,
  last_updated TEXT DEFAULT (datetime('now'))
);

-- Initialize run_state with default row
INSERT OR IGNORE INTO run_state (id) VALUES (1);

-- Per-story metrics
CREATE TABLE IF NOT EXISTS story_metrics (
  story_id TEXT PRIMARY KEY,
  tokens INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  completed_at TEXT,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

-- Execution checkpoints (for resume capability)
CREATE TABLE IF NOT EXISTS checkpoints (
  story_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  data TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (story_id, stage)
);
