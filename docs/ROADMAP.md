# Trinity Roadmap

## Current: v0.1 - CLI MVP

Core autonomous development loop.

**Status:** Planning complete, ready for implementation.

### Done
- [x] Architecture design
- [x] Command structure
- [x] Database schema
- [x] Prompt system design
- [x] Documentation

### To Build
- [ ] CLI scaffold (`cli/cmd/trinity/main.go`)
- [ ] Database API layer (`core/db/`)
- [ ] Claude Code integration (`core/claude/`)
- [ ] Loop logic (`core/loop/`)
- [ ] Prompt templates (`prompts/`)
- [ ] Crash recovery / checkpoints (`core/loop/`)
- [ ] Dependency checks - verify `claude` CLI installed
- [ ] Git state validation - clean tree, correct branch
- [ ] Timeout handling - configurable per-story timeout
- [ ] Token tracking - log usage per story for cost visibility
- [ ] Test on real project

---

## v0.2 - Auth

Authentication and subscription gating.

### Features
- OAuth authentication (Google/GitHub)
- Subscription validation
- License key support (offline use)

---

## v0.3 - Team Workflows

Shared database for team collaboration.

### Database Options
- **Solo (default)**: SQLite in `~/.trinity/` - no setup required
- **Team options** (v0.3):
  - We provide Turso - managed, included in subscription
  - Bring your own Turso - user provides API key
  - Bring your own DB - Postgres/MySQL connection string

### Features
- Database adapter layer in `core/db`
- `trinity config set db.provider managed|turso|postgres|mysql`
- `trinity config set db.connection <connection-string-or-api-key>`

---

## v0.4 - Cross-Project Dependencies

Reference dependencies across projects without centralizing state.

### Features
- Cross-project reference syntax: `@project:phase:epic:story`
- Query other project DBs to check dependency status
- Projects remain portable/independent
- `trinity link <project-path>` to register related projects

---

## v0.5 - GUI

Desktop app using Wails (Go + TypeScript).

### Features
- Project management dashboard
- Visual PRD editor (drag-drop stories, dependencies)
- Real-time streaming output
- Progress visualization
- Multi-project view

---

## v1.0 - Platform

Full platform with cloud features.

### Features
- Analytics and insights
- CI/CD integration
- Custom template marketplace
- Analytics and insights
- CI/CD integration

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | Go | Single binary, fast, good CLI ecosystem |
| GUI | Wails | Go-based, lighter than Electron |
| Database (solo) | SQLite | Embedded, simple, no setup |
| Database (teams) | Turso / BYOD | Turso for managed, Postgres/MySQL for enterprise |
| AI | Claude Code CLI | Execution engine, not just API |
| Storage | `~/.trinity/` | Keep user projects clean |
| Project ID | `slugify(name)-timestamp` | Unique, readable, path-independent |
| Workspaces | Git worktrees | Lightweight parallel execution |
| Auth (v0.2+) | OAuth (Google/GitHub) | No trial mode, subscription required |
| Monetization | Subscription | ~$5/month (tentative) |

---

## Open Questions

1. **Subscription tiers?** - Different limits for different prices?
2. **Template marketplace?** - User-contributed prompts/workflows?
