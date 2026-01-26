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
| `docs/knowledge/ralph.md` | Ralph CLI workflow, state management, PRD features |
| `docs/knowledge/dashboard.md` | Dashboard architecture, terminal, themes |
| `docs/knowledge/go.md` | Go workspaces, multi-module setup |
| `docs/gotchas/elvish.md` | Elvish shell pitfalls |
| `docs/gotchas/dashboard.md` | React/Next.js hydration, mobile issues |
| `docs/gotchas/go.md` | Go module path, workspace sync timing |
| `tools/ralph/cli/progress.txt` | Previous story history |

**Don't read docs you don't need.** A dashboard task doesn't need COMMANDS.md. A Go task doesn't need dashboard docs.

If attempt > 1 or refinement: check `git log` and `git diff` for previous work. Focus on the feedback if provided.
