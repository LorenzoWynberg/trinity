-- Add soft delete and read tracking
ALTER TABLE tasks ADD COLUMN read_at TEXT;
ALTER TABLE tasks ADD COLUMN deleted_at TEXT;

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_read ON tasks(read_at);
