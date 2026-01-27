# Context Loading

**Always read first:**
- `CLAUDE.md` - project rules and conventions (required)
- `tools/ralph/cli/prd/{{VERSION}}.json` - find your story ({{CURRENT_STORY}}) and read:
  - `title` - what to do
  - `intent` - why it matters
  - `description` - implementation context, patterns, constraints (if present)
  - `acceptance` - done when all criteria met

**Then pick relevant docs based on the task:**
| Doc | When to read |
|-----|--------------|
| `docs/ARCHITECTURE.md` | System design, component relationships, data flow |
| `docs/COMMANDS.md` | CLI command specs, flags, usage |
| `docs/PROMPTS.md` | Prompt templates, placeholders, schemas |
| `tools/ralph/cli/progress.txt` | Previous story history |

**Knowledge base** (`docs/knowledge/<book>/`) - Product documentation:
| Book | Content |
|------|---------|
| `ralph/` | CLI workflow, state management, PRD features (has multiple chapters) |
| `dashboard/` | Dashboard architecture, terminal, themes |
| `trinity/` | Trinity CLI overview and architecture |
| `go/` | Go workspaces, multi-module setup |

**Gotchas** (`docs/gotchas/<book>/`) - Pitfalls to avoid:
| Book | Content |
|------|---------|
| `elvish/` | Elvish shell pitfalls |
| `dashboard/` | React/Next.js hydration, mobile issues |
| `go/` | Go module path, workspace sync timing |
| `patterns/` | Reusable patterns discovered |
| `conventions/` | Coding standards learned |

Each book is a folder with `index.json` (metadata) and `.md` files (chapters). Read `index.json` to see available chapters.

**Don't read docs you don't need.** A dashboard task doesn't need COMMANDS.md. A Go task doesn't need dashboard docs.

If attempt > 1 or refinement: check `git log` and `git diff` for previous work. Focus on the feedback if provided.
