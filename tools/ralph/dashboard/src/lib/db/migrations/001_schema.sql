-- Ralph Dashboard Schema (greenfield)
-- All tables in one clean migration

-------------------------------------------------
-- TAGS (shared across all entities)
-------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-------------------------------------------------
-- PRD: Versions, Phases, Epics, Stories
-------------------------------------------------
CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  title TEXT,
  short_title TEXT,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS phases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version_id TEXT NOT NULL,
  phase_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  UNIQUE(version_id, phase_number),
  FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS epics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version_id TEXT NOT NULL,
  phase_number INTEGER NOT NULL,
  epic_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  UNIQUE(version_id, phase_number, epic_number),
  FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  phase INTEGER NOT NULL,
  epic INTEGER NOT NULL,
  story_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  intent TEXT,
  description TEXT,
  acceptance TEXT,              -- JSON array
  depends_on TEXT,              -- JSON array of story IDs

  -- Status
  passes INTEGER DEFAULT 0,
  merged INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,

  -- Git
  target_branch TEXT DEFAULT 'dev',
  working_branch TEXT,
  pr_url TEXT,
  merge_commit TEXT,

  -- External dependencies
  external_deps TEXT,           -- JSON array
  external_deps_report TEXT,

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stories_version ON stories(version_id);
CREATE INDEX IF NOT EXISTS idx_stories_phase_epic ON stories(phase, epic);
CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(passes, merged, skipped);

-- Story tags junction
CREATE TABLE IF NOT EXISTS story_tags (
  story_id TEXT NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (story_id, tag_id),
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_story_tags_story ON story_tags(story_id);
CREATE INDEX IF NOT EXISTS idx_story_tags_tag ON story_tags(tag_id);

-- Story validation stages
CREATE TABLE IF NOT EXISTS story_validation (
  story_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  passed INTEGER DEFAULT 0,
  checked_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (story_id, stage),
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

-------------------------------------------------
-- EXECUTION STATE
-------------------------------------------------
CREATE TABLE IF NOT EXISTS run_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_story TEXT,
  status TEXT DEFAULT 'idle',
  attempts INTEGER DEFAULT 0,
  last_completed TEXT,
  last_error TEXT,
  last_updated TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO run_state (id) VALUES (1);

CREATE TABLE IF NOT EXISTS execution_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id TEXT NOT NULL,
  attempt INTEGER DEFAULT 1,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  duration_seconds INTEGER,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  status TEXT,
  error_message TEXT,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_execution_log_story ON execution_log(story_id);
CREATE INDEX IF NOT EXISTS idx_execution_log_status ON execution_log(status);

-------------------------------------------------
-- BACKGROUND TASKS
-------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  version TEXT,
  status TEXT DEFAULT 'pending',
  input TEXT,
  result TEXT,
  error TEXT,
  context TEXT,
  deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);

-------------------------------------------------
-- SETTINGS
-------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-------------------------------------------------
-- ACTIVITY LOGS
-------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL DEFAULT 'ralph',
  date TEXT NOT NULL,
  time TEXT,
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'complete',
  files_changed TEXT,           -- JSON array
  files_created TEXT,           -- JSON array
  tags TEXT,                    -- JSON array (denormalized for simplicity)
  story_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_project ON activity_logs(project);
CREATE INDEX IF NOT EXISTS idx_activity_logs_date ON activity_logs(date);
CREATE INDEX IF NOT EXISTS idx_activity_logs_story ON activity_logs(story_id);

-------------------------------------------------
-- KNOWLEDGE BASE
-------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK (category IN ('knowledge', 'gotcha')),
  slug TEXT,
  title TEXT NOT NULL,
  content TEXT,
  story_id TEXT,
  source TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_slug ON knowledge(slug);
CREATE INDEX IF NOT EXISTS idx_knowledge_story ON knowledge(story_id);

-- Knowledge tags junction
CREATE TABLE IF NOT EXISTS knowledge_tags (
  knowledge_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (knowledge_id, tag_id),
  FOREIGN KEY (knowledge_id) REFERENCES knowledge(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_knowledge_tags_knowledge ON knowledge_tags(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_tags_tag ON knowledge_tags(tag_id);
