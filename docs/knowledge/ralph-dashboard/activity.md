# Activity

The activity page displays daily activity logs.

## Features

- Daily log entries with timestamps
- Project filtering (trinity/ralph)
- Markdown rendering with syntax highlighting
- Client-side rendering for dynamic updates

## Log Location

Activity logs are stored in:
```
logs/activity/<project>/YYYY-MM-DD.md
```

Example: `logs/activity/trinity/2026-01-27.md`

## Log Format

Each day's log is a markdown file with YAML frontmatter for machine-readable metadata:

```markdown
---
title: "Add authentication"
time: "2026-01-27 ~14:00 CR"
status: complete
files_changed:
  - src/auth/login.go
  - src/middleware/jwt.go
tags: [auth, api]
---

## Feature: Add authentication

**Time:** 2026-01-27 ~14:00 CR

### What was done
- Implemented login endpoint
- Added JWT middleware

### Files modified
- src/auth/login.go
- src/middleware/jwt.go
```

The YAML frontmatter enables:
- Dashboard queries (filter by status, tags, files)
- Metrics aggregation (count changes, track patterns)
- Trend analysis over time

## Project Tabs

Switch between projects using tabs:
- **Trinity** - Core Trinity development activity
- **Ralph** - Ralph CLI and dashboard activity
