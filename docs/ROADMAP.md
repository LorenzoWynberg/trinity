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
- [ ] Test on real project

---

## v0.2 - GUI + Auth

Desktop app using Wails (Go + TypeScript), plus authentication.

### Features
- OAuth authentication (Google/GitHub)
- Project management dashboard
- Visual PRD editor (drag-drop stories, dependencies)
- Real-time streaming output
- Progress visualization
- Multi-project view

---

## v1.0 - Platform

Full platform with cloud features.

### Features
- Cloud sync for PRDs/progress
- Team collaboration
- Custom template marketplace
- Analytics and insights
- CI/CD integration

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | Go | Single binary, fast, good CLI ecosystem |
| GUI | Wails | Go-based, lighter than Electron |
| Database | SQLite | Embedded, simple, handles concurrency |
| AI | Claude Code CLI | Execution engine, not just API |
| Storage | `~/.trinity/` | Keep user projects clean |
| Project ID | `slugify(name)-timestamp` | Unique, readable, path-independent |
| Workspaces | Git worktrees | Lightweight parallel execution |
| Auth (v0.2+) | OAuth (Google/GitHub) | No trial mode, subscription required |
| Monetization | Subscription | ~$5/month (tentative) |

---

## Open Questions

1. **Subscription tiers?** - Different limits for different prices?
2. **Team features scope?** - What collaboration features for v1.0?
3. **Template marketplace?** - User-contributed prompts/workflows?
