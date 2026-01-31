# Multi-Agent Handoffs

The dashboard orchestrates multiple specialized AI agents that work together through a handoff system.

## Agent Pipeline

```
Orchestrator → Analyst → Implementer ⇄ Reviewer → Refactorer → Documenter → Complete
                              ↑______________|
                                 (reject loop)
```

### Agents

| Agent | Role |
|-------|------|
| **Orchestrator** | Dashboard itself - initiates the pipeline |
| **Analyst** | Reads story, analyzes codebase, creates implementation plan |
| **Implementer** | Writes code following the plan, runs tests |
| **Reviewer** | Reviews implementation, approves or rejects with feedback |
| **Refactorer** | Polishes working code without changing behavior |
| **Documenter** | Updates docs, adds comments, signals completion |

### Handoff Flow

1. **Create**: Agent A completes work, creates handoff to Agent B
2. **Accept**: Agent B picks up handoff, starts work
3. **Reject** (optional): Agent B rejects with reason, returns to previous agent

## Database Schema

```sql
CREATE TABLE agent_handoffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id TEXT NOT NULL,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending/accepted/rejected
  payload TEXT,                   -- JSON: analysis, plan, review notes
  rejection_reason TEXT,
  created_at TEXT NOT NULL,
  processed_at TEXT,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);
```

## API

### GET `/api/handoffs`

Query handoffs by story or agent:

```bash
# Get state for a story (pipeline view)
GET /api/handoffs?storyId=v0.1:1.1.1

# Get pending handoff for an agent
GET /api/handoffs?storyId=v0.1:1.1.1&agent=implementer

# Find stale handoffs (cleanup)
GET /api/handoffs?stale=true&minutes=30
```

**Response (state query):**
```json
{
  "currentAgent": "implementer",
  "phase": "implementing",
  "handoffs": [
    {
      "id": 1,
      "story_id": "v0.1:1.1.1",
      "from_agent": "orchestrator",
      "to_agent": "analyst",
      "status": "accepted",
      "payload": { "story": {...} },
      "created_at": "2026-01-31T10:00:00Z",
      "processed_at": "2026-01-31T10:00:05Z"
    }
  ]
}
```

### POST `/api/handoffs`

Create or process handoffs:

```bash
# Create handoff
curl -X POST /api/handoffs \
  -d '{
    "action": "create",
    "storyId": "v0.1:1.1.1",
    "fromAgent": "analyst",
    "toAgent": "implementer",
    "payload": { "plan": "..." }
  }'

# Accept handoff
curl -X POST /api/handoffs \
  -d '{ "action": "accept", "handoffId": 1 }'

# Reject handoff
curl -X POST /api/handoffs \
  -d '{
    "action": "reject",
    "handoffId": 1,
    "reason": "Tests failing"
  }'

# Timeout stale handoff
curl -X POST /api/handoffs \
  -d '{ "action": "timeout", "handoffId": 1 }'

# Cleanup all pending for story
curl -X POST /api/handoffs \
  -d '{ "action": "cleanup", "storyId": "v0.1:1.1.1" }'
```

## Agent Prompts

Agent identities are defined in `agents/*.md`:

```
agents/
├── analyst.md
├── implementer.md
├── reviewer.md
├── refactorer.md
└── documenter.md
```

Each prompt includes:
- Identity and role
- Responsibilities
- Handoff format (what to include in payload)
- Context note for variable substitution

### Variable Substitution

Prompts use shell-style variables that Claude substitutes from execution context:

```markdown
> **Context:** Use `DASHBOARD_URL` and `STORY_ID` from your execution prompt.

curl -X POST $DASHBOARD_URL/api/handoffs ...
```

The execution prompt defines:
```
DASHBOARD_URL = http://localhost:3000
STORY_ID = v0.1:1.1.1
BRANCH = feat/story-1.1.1
```

## UI Components

### StoryHandoffs (`/stories/[id]`)

Shows on story detail page:
- **Pipeline visualization**: 5 agents with status indicators
- **Handoff history**: Expandable list with timestamps
- **Payload inspection**: Click to view JSON payload
- **Rejection details**: Shows rejection reasons

### Run Modal (`/run`)

During execution step:
- Shows current agent name
- Visual pipeline progress
- Blue pulse for active agent
- Green check for completed steps

## Real-time Updates

Handoff changes emit SSE events:

```typescript
// In src/lib/events.ts
emit('handoff', { storyId, handoffId, status })
```

The frontend handles these in `src/lib/query/sse.ts`:
```typescript
case 'handoff':
  queryClient.invalidateQueries({ queryKey: queryKeys.handoffs(event.data.storyId) })
  break
```

## Valid Transitions

| From | To |
|------|----|
| orchestrator | analyst |
| analyst | implementer |
| implementer | reviewer |
| reviewer | refactorer (approve) or implementer (reject) |
| refactorer | documenter |
| documenter | orchestrator (complete) |

## Stale Handoff Management

Handoffs older than 30 minutes are considered stale:

- Auto-cleaned on `POST /api/run { "action": "start" }`
- Queryable via `GET /api/handoffs?stale=true&minutes=30`
- Can be timed out via `POST /api/handoffs { "action": "timeout", "handoffId": X }`
