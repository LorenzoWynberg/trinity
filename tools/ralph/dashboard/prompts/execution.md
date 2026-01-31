# Story {{STORY_ID}}

**Context:** Version {{VERSION}} | Branch: `{{BRANCH}}` | Attempt: {{ATTEMPT}}

{{FEEDBACK}}

## Multi-Agent Workflow

This story is handled by a team of specialized agents. You are the **Orchestrator**.

```
Analyst → Implementer ⇄ Reviewer → Documenter → Complete
           (can loop if rejected)
```

### Agents

| Agent | Identity | Role |
|-------|----------|------|
| Analyst | `agents/analyst.md` | Understands requirements, creates plan |
| Implementer | `agents/implementer.md` | Writes clean, minimal code |
| Reviewer | `agents/reviewer.md` | Catches issues, approves or rejects |
| Documenter | `agents/documenter.md` | Captures learnings, updates docs |

### Your Job

1. **Start the chain** - Create handoff to Analyst:
   ```bash
   curl -X POST {{DASHBOARD_URL}}/api/handoffs \
     -H "Content-Type: application/json" \
     -d '{
       "action": "create",
       "storyId": "{{STORY_ID}}",
       "fromAgent": "orchestrator",
       "toAgent": "analyst",
       "payload": {"story_id": "{{STORY_ID}}", "branch": "{{BRANCH}}"}
     }'
   ```

2. **Become each agent** - Read the agent's identity file and act as that agent until handoff

3. **On completion** - When Documenter hands off to orchestrator:
   - Log activity
   - Signal complete (execution system handles commit/PR)

## Rules

- No AI attribution in code, comments, or commits
- Implement ONLY {{STORY_ID}}
- Keep changes minimal and focused
- Timestamps: `TZ={{TIMEZONE}} date '+%Y-%m-%d %H:%M'`

## API

| Purpose | Endpoint |
|---------|----------|
| Story details | `GET {{DASHBOARD_URL}}/api/story/{{STORY_ID}}` |
| Handoffs | `GET/POST {{DASHBOARD_URL}}/api/handoffs` |
| Activity | `GET/POST {{DASHBOARD_URL}}/api/activity` |
| Knowledge | `GET/POST {{DASHBOARD_URL}}/api/knowledge` |
| Signal done | `POST {{DASHBOARD_URL}}/api/signal` |
