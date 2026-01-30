-- Execution log and schema cleanup

-- Add target_branch and working_branch to stories (replace single branch field)
ALTER TABLE stories ADD COLUMN target_branch TEXT DEFAULT 'dev';
ALTER TABLE stories ADD COLUMN working_branch TEXT;

-- Copy existing branch data to working_branch, then we can ignore the old column
UPDATE stories SET working_branch = branch WHERE branch IS NOT NULL;

-- Execution history (one row per Claude run - metrics derived from this)
CREATE TABLE IF NOT EXISTS execution_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id TEXT NOT NULL,
  attempt INTEGER DEFAULT 1,

  -- Timing
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  duration_seconds INTEGER,

  -- Tokens
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,

  -- Outcome
  status TEXT,           -- running, complete, blocked, error
  error_message TEXT,

  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_execution_log_story ON execution_log(story_id);
CREATE INDEX IF NOT EXISTS idx_execution_log_status ON execution_log(status);

-- Simplify run_state (git details now on story)
-- SQLite doesn't support DROP COLUMN easily, so we recreate the table

CREATE TABLE run_state_new (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_story TEXT,
  status TEXT DEFAULT 'idle',
  attempts INTEGER DEFAULT 0,
  last_completed TEXT,
  last_error TEXT,
  last_updated TEXT DEFAULT (datetime('now'))
);

INSERT INTO run_state_new (id, current_story, status, attempts, last_completed, last_error, last_updated)
SELECT id, current_story, status, attempts, last_completed, last_error, last_updated FROM run_state;

DROP TABLE run_state;
ALTER TABLE run_state_new RENAME TO run_state;

-- Drop story_metrics (now derived from execution_log)
DROP TABLE IF EXISTS story_metrics;
