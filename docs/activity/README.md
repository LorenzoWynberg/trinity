# Activity Logs

Daily development activity logs for Trinity.

## Purpose

Activity logs track daily development work including:
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

---

## STORY-X.X.Y: Another Story
(repeat structure)
```

## Guidelines

1. **Create a new log** at the start of each development session
2. **Update throughout** the session as work progresses
3. **Be specific** about what changed and why
4. **Link to commits** when relevant
5. **Note blockers** and how they were resolved
6. **APPEND only** - never overwrite existing content

## Usage by Ralph

Ralph automatically:
1. Reads the 2 most recent logs for context
2. Includes them in Claude's prompt via `{{RECENT_ACTIVITY_LOGS}}`
3. Claude updates the current day's log with progress

## Archive

Older activity logs are moved to `archive/` to keep the main directory clean.

**Structure:**
```
docs/activity/
├── README.md           # This file
├── 2026-01-24.md       # Recent logs (keep last 7 days)
├── 2026-01-23.md
└── archive/
    └── 2026-01/        # Monthly folders
        └── 2026-01-15.md
```

**Before archiving:**
1. Review the log for any learnings not yet captured in `docs/learnings/`
2. Extract useful patterns, gotchas, or decisions to the appropriate learnings file
3. Then move to archive

**When to archive:** Move logs older than 7 days to `archive/YYYY-MM/` folder.
