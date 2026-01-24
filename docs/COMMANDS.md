# Trinity Command Reference

Complete reference for all Trinity CLI commands and flags.

## Quick Reference

```bash
trinity auth login|logout|status     # Authentication
trinity init                         # Initialize project
trinity analyze                      # Analyze codebase
trinity prd add|show|refine|skip|retry  # PRD management
trinity run                          # Execute dev loop
trinity approve|reject               # Human testing gates
trinity status                       # Overview
trinity config show|set|edit         # Configuration
trinity hotfix "desc"                # Quick fixes
trinity release                      # Ship to main
```

---

## Commands

### `trinity auth`

Manage authentication and subscription.

```bash
trinity auth login              # Browser OAuth (Google/GitHub)
trinity auth logout             # Clear local auth session
trinity auth status             # Show subscription/auth status
```

---

### `trinity init`

Initialize Trinity for a project.

```bash
trinity init                    # Smart init (analyzes project, creates CLAUDE.md)
trinity init --skip-claude-md   # Don't create/update CLAUDE.md
trinity init --force            # Reinitialize even if already initialized
```

| Flag | Description |
|------|-------------|
| `--skip-claude-md` | Don't create or update CLAUDE.md in project |
| `--force` | Reinitialize even if project already set up |

---

### `trinity analyze`

Deep dive on codebase to understand structure and suggest what to build.

```bash
trinity analyze                 # Full analysis with suggestions
trinity analyze --json          # Output as JSON (for scripting)
trinity analyze --brief         # Short summary only
```

| Flag | Description |
|------|-------------|
| `--json` | Output structured JSON instead of formatted text |
| `--brief` | Short summary without detailed suggestions |

---

### `trinity prd`

PRD (Product Requirements Document) management.

#### `trinity prd add`

Add stories, epics, or phases to PRD.

```bash
trinity prd add                 # Interactive wizard
trinity prd add "description"   # Non-interactive with description
```

- If no PRD exists: runs full creation wizard (gather info → generate → refine loop)
- If PRD exists: AI suggests placement, handles renumbering

#### `trinity prd show`

View PRD contents.

```bash
trinity prd show                # Full PRD tree with status
trinity prd show <ref>          # Specific item (e.g., mvp:auth, mvp:auth:STORY-1.1.2)
trinity prd show --next         # What runs next
trinity prd show --blocked      # Blocked by dependencies
trinity prd show --pending      # Pending items only
trinity prd show --in-progress  # In-progress items
trinity prd show --completed    # Completed items
trinity prd show --awaiting-review  # Waiting for human testing
trinity prd show --json         # Output as JSON
```

| Flag | Description |
|------|-------------|
| `--next` | Show next runnable item (deps met) |
| `--blocked` | Show items blocked by dependencies |
| `--pending` | Filter to pending status |
| `--in-progress` | Filter to in-progress status |
| `--completed` | Filter to completed status |
| `--awaiting-review` | Show items waiting for human testing |
| `--json` | Output structured JSON |

#### `trinity prd refine`

AI review and improve stories.

```bash
trinity prd refine              # Refine entire PRD
trinity prd refine <ref>        # Refine specific phase/epic
```

#### `trinity prd skip` / `trinity prd retry`

Change story status.

```bash
trinity prd skip <ref>          # Mark as skipped
trinity prd retry <ref>         # Reset to pending
```

---

### `trinity run`

Execute the autonomous development loop.

#### Basic Execution

```bash
trinity run                     # Run next available work
trinity run <ref>               # Run specific phase/epic/story
trinity run mvp                 # Run whole phase
trinity run mvp:auth            # Run specific epic
trinity run mvp:auth:STORY-1.1.2  # Run specific story
```

#### Parallel Execution

```bash
trinity run --all               # All valid work in parallel
```

#### Dependency Handling

```bash
trinity run <ref> --with-deps   # Run dependencies first, then target
```

If a dependency is already in progress by another agent, marks target as blocked and stops.

#### Execution Control

```bash
trinity run --once              # Single story only, then exit
trinity run --docker            # Run in isolated Docker container
```

#### Attach/Control Running Loop

```bash
trinity run --attach            # Attach to running loop, stream output
trinity run --stop              # Graceful stop after current story
trinity run --kill              # Hard stop immediately
```

| Flag | Description |
|------|-------------|
| `--all` | Run all valid work in parallel (multiple agents) |
| `--with-deps` | Run unmet dependencies first, then target |
| `--once` | Execute single story only, then exit |
| `--docker` | Run Claude Code in isolated Docker container |
| `--attach` | Attach to already-running loop, stream output |
| `--stop` | Signal graceful stop (finish current story, then exit) |
| `--kill` | Hard stop immediately |

---

### `trinity approve` / `trinity reject`

Human testing gate controls.

```bash
trinity approve                 # Approve current pending test
trinity approve <ref>           # Approve specific story

trinity reject "feedback"       # Reject with feedback, Claude iterates
trinity reject <ref> "feedback" # Reject specific story
```

---

### `trinity status`

Show current state overview.

```bash
trinity status                  # Overview: agents, progress, blocked items
trinity status --watch          # Live updating status
trinity status --json           # Output as JSON
```

| Flag | Description |
|------|-------------|
| `--watch` | Continuously update display |
| `--json` | Output structured JSON |

---

### `trinity config`

Manage configuration.

```bash
trinity config show             # Show all configuration
trinity config show <key>       # Show specific key
trinity config set <key> <val>  # Set config value
trinity config edit             # Open config in $EDITOR
trinity config reset            # Reset to defaults
```

#### Configuration Keys

| Key | Description | Default |
|-----|-------------|---------|
| `integration_branch` | Branch for merging features | `dev` |
| `auto_pr` | Auto-create PR when feature completes | `true` |
| `auto_merge` | Auto-merge PRs (requires opt-in) | `false` |
| `dev_cmd` | Command to start dev server | - |
| `dev_port` | Dev server port | `3000` |
| `dev_ready_signal` | Stdout signal that dev server is ready | - |

---

### `trinity hotfix`

Fast lane for quick fixes outside the PRD flow.

```bash
trinity hotfix "description"              # Fix and PR to dev
trinity hotfix "desc" --target main       # PR directly to main (urgent)
trinity hotfix "desc" --auto-merge        # Auto-merge when CI passes
trinity hotfix "desc" --link mvp:auth     # Link to epic for tracking
trinity hotfix "desc" --commit-only       # Commit but don't create PR
```

| Flag | Description |
|------|-------------|
| `--target <branch>` | Target branch for PR (default: integration_branch) |
| `--auto-merge` | Auto-merge PR when CI passes |
| `--link <ref>` | Associate hotfix with epic for tracking |
| `--commit-only` | Create commit but don't open PR |

---

### `trinity release`

Ship to production.

```bash
trinity release                 # Merge dev → main (creates PR)
trinity release --dry-run       # Show what would be released
trinity release --tag <version> # Merge and create git tag
trinity release --direct        # Direct merge (no PR)
```

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview release without making changes |
| `--tag <version>` | Create git tag after merge (e.g., `v1.0.0`) |
| `--direct` | Merge directly without creating PR |

---

### `trinity internal`

Internal commands for Claude Code to call. **Not for direct user use.**

```bash
trinity internal complete <story>           # Mark story done
trinity internal add-story <epic> "title"   # Add story to epic
trinity internal log "message"              # Write to activity log
trinity internal learn "content" --tags x,y # Add learning with tags
trinity internal move-story <from> <to>     # Renumber story, update refs
```

These commands are queued and processed sequentially by Trinity to avoid write conflicts.

---

## Reference Syntax

### Dependency References

Universal 3-level hierarchy:

```
"mvp"                        → whole phase
"mvp:auth"                   → epic in phase
"mvp:auth:STORY-1.1.2"       → specific story
```

### Priority Levels

Optional but encouraged during PRD creation:

- `critical` - Must be done first
- `high` - Important
- `medium` - Normal priority
- `low` - Nice to have

### Story Status

- `pending` - Not started
- `in_progress` - Being worked on
- `completed` - Done
- `skipped` - Intentionally skipped
- `blocked` - Waiting on dependencies
