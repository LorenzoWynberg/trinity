# Trinity v2.0 Dashboard - Learnings from Ralph

## Overview

Ralph's dashboard (Next.js 14 + shadcn/ui + @xyflow/react) is the exact stack planned for Trinity v2.0. This doc captures what can be reused/adapted.

## Ralph Dashboard Features

| Page | Description | Trinity Applicability |
|------|-------------|----------------------|
| **Home** | Stats cards, phase progress, current work | Direct port - change data source to DB API |
| **Stories** | List with version filter, status badges | Direct port - add more filters (phase, epic, tags) |
| **Graph** | Dependency visualization with xyflow | Direct port - same approach |
| **Activity** | Timeline with project toggle | Adapt - Trinity has single project context |
| **Learnings** | Markdown viewer by category | Adapt - Trinity stores in DB, needs API |
| **Metrics** | Token usage, duration stats | Direct port - same metrics tracked |
| **Settings** | Config viewer | Expand - Trinity has more config options |

## Components to Reuse

```
components/
├── ui/                    # shadcn components (100% reusable)
├── stats-card.tsx         # Stats display (reusable)
├── progress-bar.tsx       # Progress bars (reusable)
├── story-card.tsx         # Story display (adapt for more fields)
├── stories-list.tsx       # List with filters (expand filters)
├── current-work.tsx       # Current story display (reusable)
├── markdown.tsx           # Markdown renderer (reusable)
└── version-node.tsx       # Graph node (adapt for phases/epics)
```

## Key Differences

### Data Source

**Ralph:** File-based (JSON + markdown files)
```typescript
// Ralph reads files directly
const prd = JSON.parse(await fs.readFile('prd/v1.0.json'))
const logs = await fs.readdir('logs/activity/trinity/')
```

**Trinity:** Database API
```typescript
// Trinity needs API routes hitting DB
const prd = await fetch('/api/prd').then(r => r.json())
const logs = await fetch('/api/activity').then(r => r.json())
```

### API Routes Needed for Trinity

| Route | Method | Description |
|-------|--------|-------------|
| `/api/phases` | GET | List phases with progress |
| `/api/epics` | GET | List epics, filter by phase |
| `/api/stories` | GET | List stories, filter by epic/version/status/tags |
| `/api/stories/[id]` | GET | Single story detail |
| `/api/stories/next` | GET | Next runnable story |
| `/api/activity` | GET | Activity log entries |
| `/api/learnings` | GET | Learnings with search/tags |
| `/api/metrics` | GET | Token usage, timing stats |
| `/api/agents` | GET | Active agents (for parallel work view) |
| `/api/config` | GET | Project config |

### Additional Trinity Features

1. **Phase/Epic hierarchy** - Ralph is flat stories, Trinity has 3 levels
2. **Human testing gates** - Show stories awaiting approval
3. **Multi-agent view** - See parallel agents working
4. **Dependency resolution** - Show what's blocking what
5. **Version management** - Create/release versions from UI

---

## CLI Improvements from Ralph

### 1. Release Workflow with Human Gate

Ralph's release flow should transfer to Trinity:

```
All stories complete
    ↓
Show release summary (stories, commits, files)
    ↓
Human approval prompt
  [y]es - proceed with release
  [n]o - cancel
  [e]dit tag - change version tag
  [f]eedback - run hotfix, loop back
    ↓
If approved:
  - Create PR (dev → main)
  - Merge PR
  - Tag on main (not dev!)
  - Push tag
```

**Add to Trinity:** `trinity release` should have interactive approval, not just `--dry-run`.

### 2. PR-Level Feedback Loop

Ralph's merge prompt has feedback option:

```
PR #123 ready for merge
[y]es merge  [n]o leave open  [f]eedback
> f

Enter feedback (blank line to finish):
> The login button needs to handle loading state
>

Running Claude with feedback...
```

**Add to Trinity:** After story completes, before PR merge, allow feedback that loops Claude back for iteration without restarting the whole story.

---

## Implementation Plan

### Phase 1: Port Core Components
- [ ] Copy shadcn/ui components
- [ ] Copy stats-card, progress-bar, markdown
- [ ] Set up Next.js 14 app structure

### Phase 2: Build API Layer
- [ ] Create Go HTTP handlers in `core/api/`
- [ ] Implement all API routes
- [ ] Add WebSocket for live updates (optional)

### Phase 3: Build Pages
- [ ] Dashboard home (stats, progress, current work)
- [ ] Stories list with hierarchy (phase → epic → story)
- [ ] Dependency graph
- [ ] Activity timeline
- [ ] Metrics

### Phase 4: CLI Improvements
- [ ] Release workflow with human gate
- [ ] PR feedback loop
- [ ] Interactive prompts for key decisions

---

## Open Questions

1. **Embed vs separate?** - Ship dashboard embedded in CLI binary or as separate `npm run dev`?
2. **Real-time updates?** - WebSocket or polling for live status?
3. **Graph layout persistence?** - Ralph saves layouts to files, Trinity should use DB
