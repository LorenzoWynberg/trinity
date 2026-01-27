# Activity Logging

Create or update `logs/activity/trinity/YYYY-MM-DD.md` (today's date).

## Template

```markdown
---
story_id: {{CURRENT_STORY}}
title: "[Story Title from PRD]"
status: complete
started: "YYYY-MM-DD HH:MM CR"
completed: "YYYY-MM-DD HH:MM CR"
duration_minutes: [estimated]
version: {{VERSION}}
branch: {{BRANCH}}
files_changed:
  - path/to/file1.go
  - path/to/file2.go
tags: [relevant, tags]
---

## {{CURRENT_STORY}}: [Story Title]

### What was done
- [Change 1]
- [Change 2]

### Files modified
- `path/to/file.go` - Description of changes

### Acceptance criteria met
- [x] Criterion 1
- [x] Criterion 2

### Learnings
- [Any gotchas, patterns, or insights discovered]

---
```

## Notes

- **Get current CR time:** Run `date -u '+%Y-%m-%d %H:%M'` then subtract 6 hours (CR = UTC-6, no DST)
- APPEND new entries, never overwrite existing
- Archive logs older than 7 days to `logs/activity/trinity/archive/YYYY-MM/`
