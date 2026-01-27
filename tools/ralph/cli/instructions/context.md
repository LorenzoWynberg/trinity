# Context Loading

## Required Reading

1. **Project rules**: `CLAUDE.md`
2. **Your story**: `tools/ralph/cli/prd/{{VERSION}}.json` → find {{CURRENT_STORY}}
   - `title` - what to do
   - `intent` - why it matters
   - `description` - implementation context (if present)
   - `acceptance` - done when all criteria met

## Optional Reading (pick what's relevant)

**Architecture docs:**
| Doc | When |
|-----|------|
| `docs/ARCHITECTURE.md` | System design, data flow |
| `docs/COMMANDS.md` | CLI specs, flags |
| `tools/ralph/cli/progress.txt` | Previous story history |

**Knowledge** (`docs/knowledge/`):
| Book | Content |
|------|---------|
| `ralph-cli/` | CLI workflow, state, PRD features |
| `ralph-dashboard/` | Dashboard architecture, terminal |
| `trinity/` | Trinity CLI overview |
| `go/` | Go workspaces, modules |

**Gotchas** (`docs/gotchas/`):
| Book | Content |
|------|---------|
| `elvish/` | Elvish shell pitfalls |
| `nextjs/` | React/Next.js hydration, mobile |
| `node/` | Node.js native modules |
| `go/` | Go module path issues |

Check each book's `index.json` for available chapters.

## If Retrying

If attempt > 1: check `git log` and `git diff` for previous work. Focus on the feedback.
