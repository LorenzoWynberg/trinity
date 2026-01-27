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

Each day's log is a markdown file with sections for different activities:

```markdown
# Activity Log - 2026-01-27

## Feature: Add authentication

**Time:** 2026-01-27 ~14:00 CR

### What was done
- Implemented login endpoint
- Added JWT middleware

### Files modified
- src/auth/login.go
- src/middleware/jwt.go
```

## Project Tabs

Switch between projects using tabs:
- **Trinity** - Core Trinity development activity
- **Ralph** - Ralph CLI and dashboard activity
