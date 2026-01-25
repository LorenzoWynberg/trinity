# Trinity v2.0 Dashboard Roadmap

Based on Ralph dashboard implementation. Target: full feature parity.

> **Note:** Ralph uses file-based storage (JSON, markdown). Trinity uses database.
> All APIs below query `db.*` functions instead of reading files.

| Ralph (Files) | Trinity (Database) |
|---------------|-------------------|
| `prd/v1.0.json` | `db.Stories`, `db.Phases`, `db.Epics` |
| `logs/activity/*.md` | `db.Activity` |
| `learnings/*.md` | `db.Learnings` |
| `settings.json` | `db.Settings` |
| `graph-layouts/*.json` | `db.GraphLayouts` |
| `state.json` | `db.AgentState` |

## Phase 1: Dashboard Foundation

### Epic 1: API Layer

| Story | Title | Acceptance |
|-------|-------|------------|
| 1.1.1 | Create API package structure | `core/api/` with router, middleware, handlers skeleton |
| 1.1.2 | Implement phases API | GET /api/phases returns phases with progress stats |
| 1.1.3 | Implement epics API | GET /api/epics?phase=N returns epics with progress |
| 1.1.4 | Implement stories API | GET /api/stories with filters (phase, epic, status, version, tags) |
| 1.1.5 | Implement story detail API | GET /api/stories/:id returns full story with deps |
| 1.1.6 | Implement activity API | GET /api/activity with date range, project filters |
| 1.1.7 | Implement learnings API | GET /api/learnings with search, tag filters |
| 1.1.8 | Implement metrics API | GET /api/metrics returns token usage, timing stats |
| 1.1.9 | Implement versions API | GET /api/versions returns version list with progress |
| 1.1.10 | Implement state API | GET /api/state returns current agent state |
| 1.1.11 | Implement settings API | GET/POST /api/settings for dashboard preferences |
| 1.1.12 | Implement graph-layout API | GET/POST/DELETE /api/graph-layout for layout persistence |

### Epic 2: Dashboard Setup

| Story | Title | Acceptance |
|-------|-------|------------|
| 1.2.1 | Initialize Next.js project | Next.js 14+ app router, TypeScript, Tailwind |
| 1.2.2 | Add shadcn/ui components | Button, Card, Select, Dialog, Badge, etc. |
| 1.2.3 | Create layout and navigation | Sidebar nav, header, theme toggle |
| 1.2.4 | Add @xyflow/react | Graph visualization package installed |

---

## Phase 2: Dashboard Pages

### Epic 1: Home Page

| Story | Title | Acceptance |
|-------|-------|------------|
| 2.1.1 | Create stats cards component | Reusable card showing metric + change |
| 2.1.2 | Create progress bars component | Phase/epic progress visualization |
| 2.1.3 | Create current work component | Shows active story, agent status |
| 2.1.4 | Build home page | Stats grid, phase progress, current work, recent activity |

### Epic 2: Stories Page

| Story | Title | Acceptance |
|-------|-------|------------|
| 2.2.1 | Create story card component | Shows id, title, status badge, deps count |
| 2.2.2 | Create stories list component | Filterable, sortable list |
| 2.2.3 | Create story detail modal | Full story view with acceptance criteria |
| 2.2.4 | Build stories page | List with version filter, status filter, search |
| 2.2.5 | Add story detail page | /stories/[id] with full details, dep graph |

### Epic 3: Graph Page

| Story | Title | Acceptance |
|-------|-------|------------|
| 2.3.1 | Create story node component | Status colors, versioned node ID (`v1.0:1.1.1`), click handlers |
| 2.3.2 | Create version node component | Version badge with progress bar, positioned at END of chain |
| 2.3.3 | Implement auto-layout | Horizontal, vertical, compact variants |
| 2.3.4 | Implement custom layouts | Save, load, delete named layouts |
| 2.3.5 | Add layout selector | Dropdown with built-in + custom layouts |
| 2.3.6 | Add default layout per version | Star button to set default |
| 2.3.7 | Implement click-to-highlight | Click node shows dependency path |
| 2.3.8 | Add depth-based edge colors | Per-version rainbow gradient (25 colors), resets per version |
| 2.3.9 | Add version node connections | Leaf stories → version edges (version at END of chain) |
| 2.3.10 | Implement double-click modal | Double-click opens story detail |
| 2.3.11 | Add dead-ends toggle | Orange footer on leaf nodes, toggle button |
| 2.3.12 | Add fullscreen mode | Fullscreen button, ESC to exit |
| 2.3.13 | Add minimap | Corner minimap for navigation |
| 2.3.14 | Add per-version color gradients | Each version has independent color range (cyan→yellow) |
| 2.3.15 | Build graph page | Full graph with all controls |

### Epic 4: Activity Page

| Story | Title | Acceptance |
|-------|-------|------------|
| 2.4.1 | Create activity entry component | Timestamp, action, story ref, details |
| 2.4.2 | Create activity timeline | Grouped by date, infinite scroll |
| 2.4.3 | Build activity page | Timeline with date filter |

### Epic 5: Learnings Page

| Story | Title | Acceptance |
|-------|-------|------------|
| 2.5.1 | Create learning card component | Title, tags, preview |
| 2.5.2 | Create markdown viewer | Render markdown with syntax highlighting |
| 2.5.3 | Build learnings page | List with tag filter, search, detail view |

### Epic 6: Metrics Page

| Story | Title | Acceptance |
|-------|-------|------------|
| 2.6.1 | Create chart components | Bar, line, pie charts |
| 2.6.2 | Build metrics page | Token usage, story duration, success rate |

### Epic 7: Settings Page

| Story | Title | Acceptance |
|-------|-------|------------|
| 2.7.1 | Build settings page | Theme, default graph layout, other prefs |

---

## Phase 3: Advanced Features

### Epic 1: Real-time Updates

| Story | Title | Acceptance |
|-------|-------|------------|
| 3.1.1 | Add WebSocket support | Server-side WebSocket handler |
| 3.1.2 | Implement live status updates | Story status changes push to dashboard |
| 3.1.3 | Add activity stream | Real-time activity feed |

### Epic 2: Multi-Agent View

| Story | Title | Acceptance |
|-------|-------|------------|
| 3.2.1 | Create agent card component | Shows agent, current story, workspace |
| 3.2.2 | Build agents panel | List of active agents with status |
| 3.2.3 | Add agent view to graph | Highlight which agent is on which story |

### Epic 3: Human Testing Gates

| Story | Title | Acceptance |
|-------|-------|------------|
| 3.3.1 | Create approval queue | List stories awaiting human approval |
| 3.3.2 | Add approve/reject UI | Buttons with feedback input |
| 3.3.3 | Add testing instructions view | Show what to test, URL to visit |

---

## Summary

| Phase | Epic | Stories | Description |
|-------|------|---------|-------------|
| 1 | 1 | 12 | API Layer |
| 1 | 2 | 4 | Dashboard Setup |
| 2 | 1 | 4 | Home Page |
| 2 | 2 | 5 | Stories Page |
| 2 | 3 | 15 | Graph Page |
| 2 | 4 | 3 | Activity Page |
| 2 | 5 | 3 | Learnings Page |
| 2 | 6 | 2 | Metrics Page |
| 2 | 7 | 1 | Settings Page |
| 3 | 1 | 3 | Real-time Updates |
| 3 | 2 | 3 | Multi-Agent View |
| 3 | 3 | 3 | Human Testing Gates |

**Total: 58 stories across 3 phases**

---

## Key Features from Ralph

### Graph Visualization
- [x] Horizontal/vertical layouts with compact variants
- [x] Custom layout save/load/delete
- [x] Default layout per version
- [x] Click to highlight dependency path
- [x] Depth-based rainbow edge colors (25 colors, per-version gradients)
- [x] Version nodes at END of chain (as deliverable/goal)
- [x] Version nodes always visible (not just in all-versions view)
- [x] Versioned node IDs prevent conflicts (`v1.0:mvp:auth:1`)
- [x] Double-click for story modal
- [x] Dead-ends toggle (orange indicator)
- [x] Fullscreen mode
- [x] Minimap navigation
- [x] Edge z-index by pixel length (shorter edges on top)

### Dependency System
- [x] Phase dependencies ("mvp" = all leaf stories in mvp phase)
- [x] Epic dependencies ("mvp:auth" = auth epic in mvp phase)
- [x] Story dependencies ("mvp:auth:1" = story 1 in auth epic)
- [x] Cross-version story dependencies ("v1.0:mvp:auth:1")
- [x] Cross-version whole version dependencies ("v1.0" = entire version complete)
- [x] Cross-version edges styled orange dotted

### Story ID Format (Trinity)
```
mvp                      → whole phase (all leaf stories)
mvp:auth                 → epic (all leaf stories in epic)
mvp:auth:1               → specific story
v1.0:mvp:auth:1          → cross-version specific story
v1.0                     → entire version must be complete
```

Note: Ralph uses numeric format (`1.2.3`), Trinity uses named format (`mvp:auth:1`)

### Settings Persistence
- [x] Graph layout per version
- [x] Dead-ends toggle state
- [x] Theme preference
