# Trinity Activity Logs

Daily development activity logs for Trinity CLI tool development.

**Written by:** Ralph (autonomous development loop)

## Purpose

Activity logs track daily Trinity development work including:
- Features implemented
- Bugs fixed
- Decisions made
- Problems encountered and solutions
- Next steps identified

## File Format

Each day's activity is recorded in a file named `YYYY-MM-DD.md`:
- `2026-01-23.md` - Activity for January 23, 2026

## Template

```markdown
# Activity Log - YYYY-MM-DD

## Summary
Brief overview of what was accomplished today.

## STORY-X.X.X: Story Title

### What was done
- Change 1
- Change 2

### Files Modified
- `path/to/file.go` - Description of changes

### Decisions Made
- Decision and rationale

### Issues Encountered
- Problem and how it was resolved
```

## Usage by Ralph

Ralph automatically:
1. Reads the 2 most recent logs for context
2. Includes them in Claude's prompt via `{{RECENT_ACTIVITY_LOGS}}`
3. Claude updates the current day's log with progress

## Archive

Older activity logs are moved to `archive/` to keep the main directory clean.

**Structure:**
```
logs/activity/trinity/
├── README.md           # This file
├── 2026-01-24.md       # Recent logs (keep last 7 days)
├── 2026-01-23.md
└── archive/
    └── 2026-01/        # Monthly folders
        └── 2026-01-15.md
```

**When to archive:** Ralph moves logs older than 7 days to `archive/YYYY-MM/` folder.
