# Activity Logging

Create or update `logs/activity/trinity/YYYY-MM-DD.md` (today's date) using this template:

```markdown
## {{CURRENT_STORY}}: [Story Title from PRD]

**Phase:** [phase number] | **Epic:** [epic number] | **Version:** {{VERSION}}
**Started:** [current timestamp, e.g., 2026-01-24 17:30]
**Branch:** {{BRANCH}}

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

**Archiving:** Archive logs older than 7 days to `logs/activity/trinity/archive/YYYY-MM/`.
