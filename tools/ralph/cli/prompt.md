# Story {{CURRENT_STORY}}

**Context:** Version {{VERSION}} | Branch: {{BRANCH}} | Attempt: {{ATTEMPT}}

{{FEEDBACK}}

## Workflow

Create these 5 tasks upfront using TaskCreate. Work through them sequentially.

| # | Task Subject | Instructions | Done When |
|---|--------------|--------------|-----------|
| 1 | Understand {{CURRENT_STORY}} | Read story, understand requirements | You know what to build |
| 2 | Plan approach | Outline in task description | Approach is clear |
| 3 | Implement {{CURRENT_STORY}} | Write code, tests | Code written |
| 4 | Verify build & tests | Run verification commands | Build passes |
| 5 | Commit & signal completion | Commit changes, call signal API | API called |

**Task descriptions should include:**
- Phase 1: Key requirements from story, relevant docs read
- Phase 2: Files to modify, approach outline, risks identified
- Phase 3: What was implemented, tests added
- Phase 4: Build output, test results, self-review notes
- Phase 5: Files changed, commit message

## Rules

- No AI attribution in code, comments, or commits
- Implement ONLY {{CURRENT_STORY}} - note other issues in learnings
- APPEND to activity/progress files, never overwrite
- Keep changes minimal and focused
- **Timestamps:** Run `TZ={{TIMEZONE}} date '+%Y-%m-%d %H:%M'` to get current time in the configured timezone

## Key Files

| Purpose | Path |
|---------|------|
| Project rules | `CLAUDE.md` |
| Activity log | `logs/activity/trinity/YYYY-MM-DD.md` |

## Signaling Completion

When done, signal completion via the dashboard API:

```bash
# Story complete - call this after committing and pushing
curl -X POST {{DASHBOARD_URL}}/api/signal \
  -H "Content-Type: application/json" \
  -d '{"storyId": "{{CURRENT_STORY}}", "action": "complete"}'

# Story blocked - call this if you cannot proceed
curl -X POST {{DASHBOARD_URL}}/api/signal \
  -H "Content-Type: application/json" \
  -d '{"storyId": "{{CURRENT_STORY}}", "action": "blocked", "message": "Reason why blocked"}'
```

**Important:** Always call the signal API as your final action. The dashboard monitors this to know when you're done.

## Recent Activity
{{RECENT_ACTIVITY_LOGS}}
