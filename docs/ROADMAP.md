# Trinity Roadmap

## v1.0 - CLI Core

Command-line tool with autonomous development loop and authentication.

**Status:** Planning complete, ready for implementation.

### Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| CLI | Go + Cobra | Single binary distribution |
| Database | SQLite | Embedded, zero config |
| AI Engine | Claude Code CLI | Shells out to `claude` |

### Done
- [x] Architecture design
- [x] Command structure
- [x] Database schema
- [x] Prompt system design
- [x] Documentation

### CLI Core

**Commands:**
```bash
trinity init              # Initialize project
trinity analyze           # Analyze codebase
trinity plan add          # Add stories from description
trinity run [ref]         # Execute stories
trinity status            # Show progress
trinity auth login        # Authenticate
```

**Core Loop:**
1. Query DB for next story (dependencies met)
2. Create feature branch (auto-managed)
3. Build prompt from template + context
4. Run Claude Code with `--dangerously-skip-permissions`
5. Parse signals (`<story-complete>`, `<story-blocked>`)
6. Self-review and iterate if needed
7. Create PR, merge to dev
8. Record metrics (tokens, duration)
9. Repeat until complete

**Packages:**
- `core/config` - Configuration management
- `core/db` - SQLite database layer
- `core/claude` - Claude Code integration
- `core/loop` - Autonomous execution loop
- `core/prd` - PRD parsing and queries
- `core/auth` - Authentication and subscription

### Authentication

- OAuth authentication (Google/GitHub)
- Subscription validation
- License key support (offline use)

---

## v2.0 - Local Dashboard

Web-based dashboard with full CLI control for solo developers.

### Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Dashboard | Next.js 14 | App Router, TypeScript |
| Styling | Tailwind CSS | Utility-first CSS |
| Components | shadcn/ui | Radix primitives, customizable |
| Graph | @xyflow/react | Dependency visualization |
| Themes | next-themes | Dark/light mode |

### Architecture
- Next.js frontend embedded in Go binary via `go:embed`
- Go serves static files + REST API + WebSocket
- Single port (default :3000)
- Auto-opens browser on launch

### Pages
- **Home** - Stats cards, phase progress bars, current work
- **Stories** - List with phase/epic/status filters, search
- **Graph** - Interactive dependency visualization (click to highlight path, double-click for details)
- **Activity** - Filterable activity logs by date
- **Metrics** - Token usage, costs, timing per story
- **Learnings** - Browse gotchas, patterns, conventions
- **Settings** - Theme toggle, preferences

### Control Features (same as CLI)
- Start/stop story execution
- Run single story or all stories
- Skip stories with reason
- Retry failed stories
- View live Claude output
- Approve/reject human testing gates

### View Features
- Dark/light theme (persisted)
- Real-time updates via WebSocket
- Live Claude output streaming
- 5-second polling fallback
- Responsive layout

---

## v3.0 - Teams & Cloud

Shared databases and hosted dashboard for team collaboration.

### Database Adapters
Local dashboard connects to any supported database:
- **Solo (default)**: SQLite in `~/.trinity/` - no setup required
- **Team options**:
  - **Turso** - managed libSQL, included in subscription
  - **Bring your own Turso** - user provides API key
  - **PostgreSQL** - standard connection string
  - **MySQL** - standard connection string

### Configuration
```bash
trinity config set db.provider sqlite|turso|postgres|mysql
trinity config set db.connection <connection-string-or-api-key>
```

### Team Dashboard Features
- Multi-agent view - see all team members' active agents
- Team activity feed - combined activity from all agents
- Conflict detection - warnings for potential merge conflicts
- Team metrics - aggregated token usage and velocity

### Hosted Dashboard
Remote access to Trinity dashboard without running CLI locally:
- Same UI as local dashboard
- Connects to team database (Turso/Postgres/MySQL)
- View progress, activity, metrics from anywhere
- No CLI installation required for viewers
- **Read-only** - cannot trigger runs (Claude Code auth requires local CLI)

**Future consideration:** Hosted workspaces with remote execution pending Claude Code auth solutions.

---

## v4.0 - Cross-Project Dependencies

Reference dependencies across projects without centralizing state.

### Features
- Cross-project reference syntax: `@project:phase:epic:story`
- Query other project DBs to check dependency status
- Projects remain portable/independent
- `trinity link <project-path>` to register related projects

---

## v5.0 - Wails Desktop App

Native desktop app using Wails (Go + TypeScript).

All dashboard features from v2.0 (full CLI control), plus:
- **Native desktop experience** - runs as app, not browser
- **Project management** - create/switch projects from GUI
- **Visual PRD editor** - drag-drop stories, visual dependency editing
- **Real-time streaming output** - embedded terminal view
- **Progress visualization** - enhanced graphs and charts
- **Multi-project view** - manage multiple projects in one window
- **System tray integration** - background monitoring with notifications
- **Keyboard shortcuts** - power user features

### Architecture
- Reuses `core/` packages (same Go backend as CLI)
- Reuses dashboard components where applicable
- Wails for native window management
- TypeScript frontend with React

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | Go | Single binary, fast, good CLI ecosystem |
| CLI Framework | Cobra | Standard Go CLI library |
| GUI | Wails | Go-based, lighter than Electron |
| Dashboard | Next.js 14 (embedded) | App Router, TypeScript, embeds in Go binary |
| Dashboard Styling | Tailwind CSS | Utility-first, matches shadcn |
| Dashboard Components | shadcn/ui | Radix primitives, accessible, customizable |
| Dashboard Graph | @xyflow/react | Best React graph library |
| Database (solo) | SQLite | Embedded, simple, no setup |
| Database (teams) | Turso / BYOD | Turso for managed, Postgres/MySQL for enterprise |
| AI | Claude Code CLI | Execution engine, not just API |
| Storage | `~/.trinity/` | Keep user projects clean |
| Project ID | `slugify(name)-timestamp` | Unique, readable, path-independent |
| Workspaces | Git worktrees | Lightweight parallel execution |
| Auth | OAuth (Google/GitHub) | No trial mode, subscription required |
| Monetization | Subscription | ~$5/month (tentative) |

---

## Version Summary

| Version | Focus | Key Features |
|---------|-------|--------------|
| **v1.0** | Core | CLI + Auth (working loop) |
| **v2.0** | Visualization | Local Dashboard (full control) |
| **v3.0** | Collaboration | Team DB adapters + Hosted Dashboard (read-only) |
| **v4.0** | Scale | Cross-project dependencies |
| **v5.0** | Polish | Wails Desktop GUI |

---

## Open Questions

1. **Subscription tiers?** - Different limits for different prices?
2. **Template marketplace?** - User-contributed prompts/workflows?
3. **Dashboard standalone?** - Ship dashboard as separate package for non-Trinity use?
