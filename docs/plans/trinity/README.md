# Trinity Planning Docs

Planning documents for Trinity CLI development.

## Documents

| File | Description |
|------|-------------|
| [v2-dashboard-roadmap.md](v2-dashboard-roadmap.md) | Full dashboard roadmap (57 stories, phases 9-11) |
| [v2-dashboard-learnings.md](v2-dashboard-learnings.md) | Learnings from Ralph dashboard |
| [prd-review.md](prd-review.md) | PRD updates from Ralph learnings |

## Key Improvements from Ralph

1. **Release workflow with human gate** - Interactive approval before release with feedback loop
2. **PR-level feedback loop** - `trinity pr feedback` to iterate on PRs before merge
3. **Dashboard features** - Graph with depth colors, dead-ends toggle, custom layouts, fullscreen
4. **Dependency syntax** - Phase/epic/story deps, cross-version support

## Key Difference: DB vs Files

| Ralph (Files) | Trinity (Database) |
|---------------|-------------------|
| `prd/v1.0.json` | `db.Stories`, `db.Phases`, `db.Epics` |
| `logs/activity/*.md` | `db.Activity` |
| `learnings/*.md` | `db.Learnings` |
| `settings.json` | `db.Settings` or `db.Config` |
| `graph-layouts/*.json` | `db.GraphLayouts` |
| `state.json` | `db.AgentState` |

Dashboard APIs will query the database instead of reading files.
