-- Settings table for server-side persistence/backup
-- Can be used for cross-device sync or as fallback when localStorage is cleared
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_settings_updated ON settings(updated_at);
