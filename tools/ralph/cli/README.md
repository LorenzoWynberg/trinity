# Ralph - Trinity v0.1 Builder

Ralph is an autonomous development loop that builds Trinity v0.1 by working through stories in `prd.json`. Written in [Elvish](https://elv.sh).

## Quick Start

```bash
# From the tools/ralph/cli directory
./ralph.elv

# Or from project root
./tools/ralph/cli/ralph.elv
```

## Prerequisites

- [Elvish shell](https://elv.sh/get/) - Install with `brew install elvish` (macOS) or see elv.sh/get
- [GitHub CLI](https://cli.github.com/) - For PR creation/merging
- Go 1.21+ - For building Trinity
- Claude Code CLI - The AI execution engine

## How It Works

1. **Picks next story** - Selects from `prd.json`, respecting dependencies
2. **Creates branch** - `feat/story-<phase>.<epic>.<story>` from dev
3. **Runs Claude** - Pipes prompt.md template to Claude CLI
4. **Parses signals** - Detects `<story-complete>`, `<story-blocked>`
5. **Creates PR** - Auto-creates PR to dev (or prompts if `--no-auto-pr`)
6. **Merges PR** - Prompts to merge (or auto-merges if `--auto-merge`)
7. **Updates state** - Persists progress to state.json
8. **Repeats** - Until all stories complete or max iterations

## Files

| File | Purpose |
|------|---------|
| `ralph.elv` | Main loop script (Elvish) |
| `prd.json` | Stories with dependencies (83 stories for v0.1) |
| `prompt.md` | Template sent to Claude for each story |
| `state.json` | Persistent state between runs |
| `progress.txt` | Human-readable progress log |

## Options

```bash
./ralph.elv --help                    # Show all options
./ralph.elv --resume                  # Force resume current story
./ralph.elv --reset                   # Reset state, start fresh
./ralph.elv --max-iterations 50       # Limit iterations (default: 100)
./ralph.elv --base-branch main        # Use different base branch (default: dev)
./ralph.elv --auto-pr                 # Auto-create PR without prompting
./ralph.elv --auto-merge              # Auto-merge PRs without prompting
./ralph.elv -q                        # Quiet mode (no Claude output)
```

## PRD Structure

The PRD has 83 stories across 7 phases:

| Phase | Focus | Stories |
|-------|-------|---------|
| 1 | Foundation | Go workspace, CLI scaffold, config |
| 2 | Database | SQLite, migrations, all tables |
| 3 | Claude & Git | Invocation, signals, git operations |
| 4 | Prompts | Templates, schemas, placeholders |
| 5 | Loop Logic | Selection, execution, recovery |
| 6 | CLI Commands | init, plan, run, status, internal |
| 7 | Polish | UX, docs, testing |

## Feedback Loop

When prompted for PR creation or merge, you can provide text feedback instead of just y/n:

```
Create PR? [Y]es / [n]o / or type feedback for changes
> fix the error handling in config.go

Received feedback, running refinement...
────────────────── Claude Refining ──────────────────
...
```

Ralph will:
1. Run Claude with your feedback as context
2. Claude makes the requested changes
3. Push the changes
4. Prompt again for PR/merge

This enables iterative refinement without leaving the loop.

## Signals

Claude outputs these signals to communicate with Ralph:

```
<story-complete>STORY-X.Y.Z</story-complete>  # Story finished
<story-blocked>STORY-X.Y.Z</story-blocked>    # Can't proceed
<promise>COMPLETE</promise>                    # All done
```

## State

State is persisted in `state.json`:

```json
{
  "version": 1,
  "current_story": "STORY-1.1.1",
  "status": "in_progress",
  "branch": "feat/story-1.1.1",
  "attempts": 1,
  ...
}
```

To reset: `./ralph.elv --reset`

## Dependencies

- `jq` - JSON processing
- `git` - Version control
- `gh` - GitHub CLI for PR operations
- `claude` - Claude Code CLI
- `go` - Go compiler

## Graceful Exit

Press `Ctrl+C` at any time to gracefully interrupt Ralph. It will:
- Save current state to `state.json`
- Display current story and branch info
- Exit with code 130 (standard SIGINT exit)

Resume with `./ralph.elv --resume` to continue from where you left off.

## Troubleshooting

**Story stuck?** Run with `--reset` to start fresh, or manually edit `state.json`.

**Claude timing out?** Default is 30 minutes. Check `claude-timeout` in script.

**Dependencies not met?** Check `prd.json` - story requires other stories to complete first.

**PR creation failed?** Make sure `gh auth login` is done and you have repo access.
