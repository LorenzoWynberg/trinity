# Learnings

Consolidated learnings from development. Updated by Claude and Ralph after each task.

## Structure

| File | Description |
|------|-------------|
| [go.md](go.md) | Go patterns, workspaces, modules |
| [ralph.md](ralph.md) | Ralph patterns, streaming, state |

Each file has:
- **TL;DR** at the top - one-line summary for quick scanning
- **Gotchas** at the bottom - topic-specific mistakes to avoid

## How This Works

```
┌─────────────────────────────────────────┐
│  Start task                             │
│    ↓                                    │
│  Read relevant learnings/*.md files     │
│    ↓                                    │
│  Do work, discover patterns             │
│    ↓                                    │
│  Write new learnings to appropriate file│
│    ↓                                    │
│  Next task benefits from knowledge      │
└─────────────────────────────────────────┘
```

## Updating Learnings

### Adding
1. Identify the appropriate file based on topic
2. Add under the relevant section
3. Keep entries concise (1-2 lines)
4. Focus on actionable insights, not obvious things

### Correcting
If you discover something in learnings was **wrong or incomplete**:
1. Update or remove the incorrect entry
2. Add the correct information
3. Note the correction in today's activity log

Example activity log entry:
```
### Learnings Correction
- **File:** go.md
- **Was:** "Use v0.0.0 for unpublished modules"
- **Now:** "Use v0.0.0 with replace directive for local modules"
- **Why:** Replace is needed for local development
```

### Removing
Delete entries that are:
- No longer accurate (API changed, etc.)
- Redundant (covered elsewhere)
- Too obvious to be useful
