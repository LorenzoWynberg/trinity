# Activity Logs

Ralph maintains daily activity logs that track all work done. These logs serve both as human-readable documentation and machine-readable data for the dashboard.

## Location

```
logs/activity/<project>/YYYY-MM-DD.md
```

- **trinity/** - Trinity CLI development activity
- **ralph/** - Ralph CLI and dashboard activity

## Format

Each log entry uses YAML frontmatter for structured metadata, followed by prose for human readability:

```markdown
---
story_id: 1.2.3
title: "Add authentication"
status: complete
started: "2026-01-27 14:00 CR"
completed: "2026-01-27 15:30 CR"
duration_minutes: 90
version: v0.1
branch: feat/v0.1/story-1.2.3
files_changed:
  - src/auth/login.go
  - src/middleware/jwt.go
tags: [auth, api, security]
---

## STORY-1.2.3: Add authentication

### What was done
- Implemented login endpoint
- Added JWT middleware

### Files modified
- `src/auth/login.go` - Login handler
- `src/middleware/jwt.go` - JWT validation

### Acceptance criteria met
- [x] Login endpoint returns JWT
- [x] Protected routes require valid token

### Learnings
- Go's jwt-go library requires explicit algorithm validation
```

## Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `story_id` | string | Story being worked on |
| `title` | string | Human-readable title from PRD |
| `status` | string | `complete`, `in_progress`, or `blocked` |
| `started` | string | Start timestamp in CR timezone |
| `completed` | string | Completion timestamp (if done) |
| `duration_minutes` | number | Estimated time spent |
| `version` | string | PRD version (e.g., `v0.1`) |
| `branch` | string | Git branch name |
| `files_changed` | array | List of modified file paths |
| `tags` | array | Categorization tags |

## Benefits

The YAML frontmatter enables:
- **Dashboard queries** - Filter by status, tags, files
- **Metrics aggregation** - Count changes, track patterns
- **Trend analysis** - Activity over time
- **Search** - Find work by any metadata field

## When Logs Are Written

Claude writes/updates activity logs at these points:
1. **Story start** - Creates entry with `status: in_progress`
2. **Story complete** - Updates with final status, files changed
3. **Story blocked** - Records what was tried and why blocked

## Archival

Logs older than 7 days are archived to:
```
logs/activity/<project>/archive/YYYY-MM/
```

Before archiving, extract any gotchas to `docs/gotchas/`.
