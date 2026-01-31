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
-- KNOWLEDGE BASE & GOTCHAS (book/chapter/page structure)
-------------------------------------------------

-- Chapters (directories like "ralph-dashboard", "elvish")
CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book TEXT NOT NULL CHECK (book IN ('knowledge', 'gotchas')),
  slug TEXT NOT NULL,                    -- directory name
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,                             -- lucide icon name
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(book, slug)
);

CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book);

-- Pages (markdown files within chapters)
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL,
  slug TEXT NOT NULL,                    -- filename without .md
  title TEXT NOT NULL,
  content TEXT,
  sort_order INTEGER DEFAULT 0,
  story_id TEXT,                         -- what story generated this (optional)
  source TEXT,                           -- 'extraction', 'feedback', 'manual'
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(chapter_id, slug),
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pages_chapter ON pages(chapter_id);
CREATE INDEX IF NOT EXISTS idx_pages_story ON pages(story_id);

-- Page tags junction
CREATE TABLE IF NOT EXISTS page_tags (
  page_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (page_id, tag_id),
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_page_tags_page ON page_tags(page_id);
CREATE INDEX IF NOT EXISTS idx_page_tags_tag ON page_tags(tag_id);
