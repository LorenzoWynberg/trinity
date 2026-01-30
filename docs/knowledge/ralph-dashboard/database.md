# Database

The dashboard uses SQLite via `better-sqlite3` for persistent storage. The database file lives at `tools/ralph/dashboard/dashboard.db`.

## Setup

```typescript
import { getDb, tasks, settings } from '@/lib/db'
import * as prd from '@/lib/db/prd'

// getDb() returns singleton connection with:
// - WAL mode for better concurrency
// - Foreign keys enabled
// - Auto-runs pending migrations
```

## Schema Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  versions   │────<│   phases    │     │   settings  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │            ┌─────────────┐
       └───────────<│    epics    │
       │            └─────────────┘
       │
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   stories   │────<│ checkpoints │     │    tasks    │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       │            ┌─────────────┐
       └───────────<│execution_log│
                    └─────────────┘

┌─────────────┐
│  run_state  │  (single row - current execution)
└─────────────┘
```

## PRD Tables

### versions

Version metadata for PRD releases.

```sql
CREATE TABLE versions (
  id TEXT PRIMARY KEY,           -- 'v0.1', 'v1.0', etc.
  title TEXT,
  short_title TEXT,
  description TEXT,
  created_at TEXT
);
```

### phases

Phases per version.

```sql
CREATE TABLE phases (
  version_id TEXT NOT NULL,
  id INTEGER NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (version_id, id),
  FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE
);
```

### epics

Epics per version.

```sql
CREATE TABLE epics (
  version_id TEXT NOT NULL,
  phase_id INTEGER NOT NULL,
  id INTEGER NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (version_id, phase_id, id),
  FOREIGN KEY (version_id, phase_id) REFERENCES phases(version_id, id) ON DELETE CASCADE
);
```

### stories

Story definitions with status tracking.

```sql
CREATE TABLE stories (
  id TEXT PRIMARY KEY,           -- 'v0.1:1.1.1' (version-prefixed)
  version_id TEXT NOT NULL,
  phase INTEGER NOT NULL,
  epic INTEGER NOT NULL,
  story_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  intent TEXT,
  description TEXT,
  acceptance TEXT,               -- JSON array
  depends_on TEXT,               -- JSON array
  tags TEXT,                     -- JSON array

  -- Status flags
  passes INTEGER DEFAULT 0,      -- Claude finished implementation
  merged INTEGER DEFAULT 0,      -- PR merged to target branch
  skipped INTEGER DEFAULT 0,     -- Manually skipped

  -- Git tracking
  target_branch TEXT DEFAULT 'dev',  -- Where to merge
  working_branch TEXT,               -- Feature branch
  pr_url TEXT,
  merge_commit TEXT,

  -- External dependencies
  external_deps TEXT,            -- JSON array
  external_deps_report TEXT,

  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE
);
```

## Execution Tables

### run_state

Current execution state (single row).

```sql
CREATE TABLE run_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_story TEXT,            -- FK to stories.id
  status TEXT DEFAULT 'idle',    -- idle/running/paused/waiting_gate/blocked
  attempts INTEGER DEFAULT 0,
  last_completed TEXT,           -- Last merged story ID
  last_error TEXT,
  last_updated TEXT
);
```

### execution_log

History of all Claude runs. Metrics are derived from this table.

```sql
CREATE TABLE execution_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id TEXT NOT NULL,
  attempt INTEGER DEFAULT 1,

  started_at TEXT,
  finished_at TEXT,
  duration_seconds INTEGER,

  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,

  status TEXT,                   -- running/complete/blocked/error
  error_message TEXT,

  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);
```

### checkpoints

Resume capability for mid-execution state.

```sql
CREATE TABLE checkpoints (
  story_id TEXT NOT NULL,
  stage TEXT NOT NULL,           -- validation_complete, branch_created, etc.
  data TEXT,                     -- JSON
  created_at TEXT,
  PRIMARY KEY (story_id, stage)
);
```

## Task Tables

### tasks

Background task queue for Claude-powered operations.

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,            -- 'refine' | 'generate' | 'story-edit'
  status TEXT NOT NULL,          -- 'queued' | 'running' | 'complete' | 'failed'
  version TEXT NOT NULL,
  params TEXT NOT NULL,          -- JSON
  context TEXT,                  -- JSON: returnPath, step, formData
  result TEXT,                   -- JSON: Claude's response
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  read_at TEXT,
  deleted_at TEXT
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

## Migrations

SQL files in `src/lib/db/migrations/` are applied automatically on startup:

| Migration | Description |
|-----------|-------------|
| `001_tasks.sql` | Initial tasks table |
| `002_task_context.sql` | Add context column |
| `003_settings.sql` | Settings table |
| `004_task_soft_delete.sql` | Soft delete columns |
| `005_prd.sql` | PRD tables (versions, phases, epics, stories, run_state, checkpoints) |
| `006_execution_log.sql` | Execution history, schema cleanup |

## PRD Operations

```typescript
import * as prd from '@/lib/db/prd'

// Versions
prd.versions.list()              // ['v0.1', 'v1.0', 'v2.0']
prd.versions.get('v0.1')         // { id, title, shortTitle, description }

// Stories
prd.stories.list('v0.1')         // All stories for version
prd.stories.get('v0.1:1.1.1')    // Single story
prd.stories.markPassed(id)       // Set passes = 1
prd.stories.markMerged(id, prUrl, commit)
prd.stories.setWorkingBranch(id, branch)
prd.stories.setPrUrl(id, url)

// Run state
prd.runState.get()               // Current execution state
prd.runState.update({ status: 'running', current_story: id })
prd.runState.reset()             // Clear current execution

// Execution log
const logId = prd.executionLog.start(storyId, attempt)
prd.executionLog.complete(logId, { input: 1000, output: 500 }, duration)
prd.executionLog.fail(logId, errorMessage)
prd.executionLog.getTotals()     // Aggregate metrics

// Checkpoints
prd.checkpoints.save(storyId, 'branch_created', { branch })
prd.checkpoints.get(storyId, 'branch_created')
prd.checkpoints.clear(storyId)

// Convenience
prd.getPRD('v0.1')               // Full PRD with enriched stories
prd.getAllPRDs()                 // Combined across versions
```

## Signal API

Claude signals story completion via HTTP instead of file-based signals.

### Endpoints

```
POST /api/signal
  body: {
    storyId: string,
    action: 'complete' | 'blocked' | 'progress',
    message?: string,
    prUrl?: string
  }

GET /api/signal?storyId=X
  returns: { storyId, passes, merged, skipped, working_branch, pr_url }
```

### Claude Usage

When Claude finishes a story, it calls (URL injected from `dashboardUrl` setting):

```bash
# Mark complete
curl -X POST http://localhost:3000/api/signal \
  -H "Content-Type: application/json" \
  -d '{"storyId": "v0.1:1.1.1", "action": "complete"}'

# Mark blocked
curl -X POST http://localhost:3000/api/signal \
  -H "Content-Type: application/json" \
  -d '{"storyId": "v0.1:1.1.1", "action": "blocked", "message": "Missing API key"}'
```

### Configuration

Set the dashboard URL in settings if not running on localhost:3000:

```typescript
settings.set('dashboardUrl', 'http://localhost:3001')
```

### How It Works

1. Claude runs implementation as normal
2. On completion, Claude calls `/api/signal` with status
3. API updates `stories.passes` and `execution_log`
4. Dashboard polls database to detect completion

This replaces the old XML signal parsing from Claude output.

## Seeding Data

Import PRD data from JSON files:

```bash
cd tools/ralph/dashboard
npx tsx src/lib/db/import-prd.ts
```

This reads from `tools/ralph/cli/prd/*.json` and populates the SQLite tables.

## File Location

```
tools/ralph/dashboard/
├── dashboard.db              # SQLite database (gitignored)
└── src/lib/db/
    ├── index.ts              # Connection, tasks, settings
    ├── prd.ts                # PRD operations
    ├── import-prd.ts         # JSON → SQLite seeder
    └── migrations/
        ├── 001_tasks.sql
        ├── 002_task_context.sql
        ├── 003_settings.sql
        ├── 004_task_soft_delete.sql
        ├── 005_prd.sql
        └── 006_execution_log.sql
```
