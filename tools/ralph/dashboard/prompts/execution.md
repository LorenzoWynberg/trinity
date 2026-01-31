# Story {{STORY_ID}}

Branch: `{{BRANCH}}` | Attempt: {{ATTEMPT}}

{{FEEDBACK}}

## Instructions

1. Fetch story: `curl {{DASHBOARD_URL}}/api/story/{{STORY_ID}}`
2. Read `CLAUDE.md` for project rules
3. Implement the story
4. Commit and push
5. Signal: `curl -X POST {{DASHBOARD_URL}}/api/signal -H "Content-Type: application/json" -d '{"storyId":"{{STORY_ID}}","action":"complete"}'`

If blocked: `curl -X POST {{DASHBOARD_URL}}/api/signal -H "Content-Type: application/json" -d '{"storyId":"{{STORY_ID}}","action":"blocked","message":"reason"}'`

## Rules

- No AI attribution
- Implement ONLY this story
- Keep changes minimal
- Timestamps: `TZ={{TIMEZONE}} date '+%Y-%m-%d %H:%M'`
