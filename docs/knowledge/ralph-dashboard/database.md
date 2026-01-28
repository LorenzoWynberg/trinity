# Database

The dashboard uses SQLite via `better-sqlite3` for persistent storage. The database file lives at `tools/ralph/dashboard/dashboard.db`.

## Setup

```typescript
import { getDb, tasks, settings } from '@/lib/db'

// getDb() returns singleton connection with:
// - WAL mode for better concurrency
// - Foreign keys enabled
// - Auto-runs pending migrations
```

## Tables

### tasks

Background task queue for Claude-powered operations.

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'refine' | 'generate' | 'story-edit'
  status TEXT NOT NULL,         -- 'queued' | 'running' | 'complete' | 'failed'
  version TEXT NOT NULL,
  params TEXT NOT NULL,         -- JSON: task-specific parameters
  context TEXT,                 -- JSON: returnPath, step, formData, etc.
  result TEXT,                  -- JSON: Claude's response
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  read_at TEXT,                 -- When user viewed the result
  deleted_at TEXT               -- Soft delete timestamp
);
```

### settings

Key-value store for user preferences.

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### migrations

Tracks applied migrations.

```sql
CREATE TABLE migrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);
```

## Migrations

SQL files in `src/lib/db/migrations/` are applied automatically on startup:

| Migration | Description |
|-----------|-------------|
| `001_tasks.sql` | Initial tasks table |
| `002_task_context.sql` | Add context column for navigation state |
| `003_settings.sql` | Settings table |
| `004_task_soft_delete.sql` | Add read_at and deleted_at columns |

Migrations run in filename order. Each is wrapped in a transaction.

## Task Operations

```typescript
import { tasks } from '@/lib/db'

// Create
const task = tasks.create('refine', 'v1', { storyId: '1.2.3' }, { returnPath: '/stories' })

// Query
tasks.get(id)                    // Single task by ID
tasks.list({ type, status })     // Filtered list
tasks.getActive()                // Queued or running
tasks.getNext()                  // Next queued (if nothing running)
tasks.getUnreadCount()           // Count of unread completed tasks

// Lifecycle
tasks.start(id)                  // Set status to running
tasks.complete(id, result)       // Set status to complete with result
tasks.fail(id, error)            // Set status to failed with error

// Soft delete
tasks.markRead(id)               // Set read_at
tasks.markAllRead()              // Mark all unread as read
tasks.softDelete(id)             // Set deleted_at
tasks.restore(id)                // Clear deleted_at

// Cleanup
tasks.cleanup(50)                // Keep only 50 most recent completed tasks
```

## Settings Operations

```typescript
import { settings } from '@/lib/db'

settings.get('theme')            // Get single value
settings.getAll()                // Get all as Record<string, string>
settings.set('theme', 'dark')    // Set single value (upsert)
settings.setAll({ theme, tz })   // Set multiple (transaction)
settings.delete('key')           // Remove key
settings.clear()                 // Remove all
```

## Connection

The database connection is a singleton. First call to `getDb()` initializes:
1. Opens/creates `dashboard.db`
2. Enables WAL mode and foreign keys
3. Runs pending migrations
4. Returns the connection

Subsequent calls return the same connection.

## File Location

```
tools/ralph/dashboard/
├── dashboard.db          # SQLite database file
└── src/lib/db/
    ├── index.ts          # Connection + operations
    └── migrations/       # SQL migration files
        ├── 001_tasks.sql
        ├── 002_task_context.sql
        ├── 003_settings.sql
        └── 004_task_soft_delete.sql
```

The `.db` file is gitignored. Each developer has their own local database.
