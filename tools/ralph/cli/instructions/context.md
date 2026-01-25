# Context Loading

**Always read first:**
- `CLAUDE.md` - project rules and conventions (required)
- `tools/ralph/cli/prd/{{VERSION}}.json` - acceptance criteria for {{CURRENT_STORY}} (required)

**Then pick relevant docs based on the task:**
| Doc | When to read |
|-----|--------------|
| `docs/ARCHITECTURE.md` | System design, component relationships, data flow |
| `docs/COMMANDS.md` | CLI command specs, flags, usage |
| `docs/PROMPTS.md` | Prompt templates, placeholders, schemas |
| `docs/learnings/go.md` | Go patterns, workspaces, modules |
| `docs/learnings/ralph.md` | Ralph patterns, streaming, state, PR flow |
| `docs/learnings/elvish.md` | Elvish shell gotchas (if touching ralph cli) |
| `tools/ralph/cli/progress.txt` | Previous story history |

**Don't read docs you don't need.** A dashboard task doesn't need COMMANDS.md. A Go task doesn't need ralph.md.

If attempt > 1 or refinement: check `git log` and `git diff` for previous work. Focus on the feedback if provided.
