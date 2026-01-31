-- Activity logs - session summaries written by Claude
-- Different from execution_log which tracks per-run metrics

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- When/where
  project TEXT NOT NULL DEFAULT 'ralph',  -- 'ralph' | 'trinity'
  date TEXT NOT NULL,                      -- YYYY-MM-DD
  time TEXT,                               -- ~HH:MM timezone

  -- What
  title TEXT NOT NULL,
  content TEXT,                            -- markdown body
  status TEXT DEFAULT 'complete',          -- complete, in_progress, blocked

  -- Structured data (JSON arrays)
  files_changed TEXT,
  files_created TEXT,
  tags TEXT,

  -- Links
  story_id TEXT,                           -- optional link to story

  -- Meta
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_project ON activity_logs(project);
CREATE INDEX IF NOT EXISTS idx_activity_logs_date ON activity_logs(date);
CREATE INDEX IF NOT EXISTS idx_activity_logs_story ON activity_logs(story_id);
