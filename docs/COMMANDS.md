# Trinity Command Reference

Complete reference for all Trinity CLI commands and flags.

## Quick Reference

```bash
trinity init              # Initialize project + auto-install skills
trinity analyze           # Analyze codebase + suggest skills
trinity plan              # Plan management (add, show, refine, skip, retry)
trinity run               # Execute dev loop
trinity approve/reject    # Human testing gates
trinity status            # Overview
trinity config            # Configuration (show, set, edit)
trinity skills            # Manage skills (list, suggest, add, remove, search)
trinity hotfix            # Quick fixes
trinity release           # Ship to main
trinity auth              # Authentication (v0.2+)
```

---

## Commands

### `trinity auth` (v0.2+)

Manage authentication and subscription. Not required for v0.1 - auth/billing handled externally.

```bash
trinity auth login        # Browser OAuth (Google/GitHub)
trinity auth logout       # Clear local session
trinity auth status       # Show subscription status
```

---

### `trinity init`

Initialize Trinity for a project.

```bash
trinity init                     # Analyze, create CLAUDE.md, install skills
trinity init --skip-claude-md    # Don't create CLAUDE.md
trinity init --skip-skills       # Don't auto-install skills
trinity init --no-ai-attribution # Prevent AI attribution in code
trinity init --force             # Reinitialize existing project
```

**Generated CLAUDE.md includes:**
- Project-specific guidance based on detected stack
- Build/test commands
- Architecture overview
- (Optional) No-AI-attribution rule if `--no-ai-attribution` flag used

**Auto-installs skills globally based on detected stack:**
- Go project → `golang-pro`, `cli-developer` (if CLI)
- React/Next.js → `react-expert`, `nextjs-developer`
- Python → `python-pro`, `fastapi-expert` (if FastAPI)
- etc.

Use `--skip-skills` to disable automatic skill installation.

---

### `trinity analyze`

Deep dive on codebase to understand structure and suggest what to build.

```bash
trinity analyze           # Full analysis with suggestions
trinity analyze --json    # Output as JSON
trinity analyze --brief   # Short summary only
```

**Suggests missing skills:**
```
Stack: Go with gRPC microservices
Structure: Clean architecture (handlers/, services/, models/)

⚠ Suggested skills (not installed):
  • microservices-architect - You have gRPC service definitions
  • api-designer - You have OpenAPI specs

  Run: trinity skills add microservices-architect api-designer
```

---

### `trinity plan`

PRD (Product Requirements Document) management.

#### `trinity plan add`

Add stories, epics, or phases to PRD.

```bash
trinity plan add                   # Interactive wizard (creates PRD if none exists)
trinity plan add "description"     # Non-interactive with description
trinity plan show                  # Full PRD tree with status
trinity plan show <ref>            # Specific item (mvp:auth, mvp:auth:STORY-1.1.2)
trinity plan show --next           # What runs next
trinity plan show --blocked        # Blocked by dependencies
trinity plan show --pending        # Pending items only
trinity plan show --in-progress    # In-progress items
trinity plan show --completed      # Completed items
trinity plan show --awaiting-review # Waiting for human testing
trinity plan show --json           # Output as JSON
trinity plan refine                # Refine entire PRD
trinity plan refine <ref>          # Refine specific phase/epic
trinity plan skip <ref>            # Mark as skipped
trinity plan retry <ref>           # Reset to pending
```

---

### `trinity run`

Execute the autonomous development loop.

```bash
trinity run                       # Run next available work
trinity run <ref>                 # Run specific phase/epic/story
trinity run mvp                   # Run whole phase
trinity run mvp:auth              # Run specific epic
trinity run mvp:auth:STORY-1.1.2  # Run specific story
trinity run --all                 # All valid work in parallel
trinity run --max-iterations 50   # Limit loop iterations (default 100)
trinity run --with-deps           # Run dependencies first, then target
trinity run --once                # Single story only, then exit
trinity run --docker              # Run in isolated Docker container
trinity run --attach              # Attach to running loop, stream output
trinity run --stop                # Graceful stop after current story
trinity run --kill                # Hard stop immediately
```

If a dependency is in progress by another agent, marks target as blocked and stops.

---

### `trinity approve` / `trinity reject`

Human testing gate controls.

```bash
trinity approve                   # Approve current pending test
trinity approve <ref>             # Approve specific story
trinity reject "feedback"         # Reject with feedback, Claude iterates
trinity reject <ref> "feedback"   # Reject specific story
```

---

### `trinity status`

Show current state overview.

```bash
trinity status                    # Overview: agents, progress, blocked
trinity status --watch            # Live updating status
trinity status --json             # Output as JSON
trinity status --cost             # Show token usage summary
trinity status --cost --today     # Today's usage only
```

---

### `trinity config`

Manage configuration.

```bash
trinity config show               # Show all configuration
trinity config show <key>         # Show specific key
trinity config set <key> <val>    # Set config value
trinity config edit               # Open config in $EDITOR
trinity config reset              # Reset to defaults
```

**Configuration keys:**
- `integration_branch` - Branch for merging features (default: `dev`)
- `auto_pr` - Auto-create PR when feature completes (default: `true`)
- `auto_merge` - Auto-merge PRs (default: `false`)
- `dev_cmd` - Command to start dev server
- `dev_port` - Dev server port (default: `3000`)
- `dev_ready_signal` - Stdout signal that dev server is ready
- `story_timeout` - Max time per story before timeout (default: `30m`)
- `db.provider` - Database provider: `sqlite` (default), `managed`, `turso`, `postgres`, `mysql` (v0.3+)
- `db.connection` - Connection string or API key for remote databases (v0.3+)

---

### `trinity hotfix`

Fast lane for quick fixes outside the PRD flow.

```bash
trinity hotfix "description"      # Fix and PR to dev
trinity hotfix --target main      # PR directly to main (urgent)
trinity hotfix --auto-merge       # Auto-merge when CI passes
trinity hotfix --link mvp:auth    # Link to epic for tracking
trinity hotfix --commit-only      # Commit but don't create PR
```

---

### `trinity release`

Ship to production.

```bash
trinity release                   # Merge dev → main (creates PR)
trinity release --dry-run         # Show what would be released
trinity release --tag v1.0.0      # Merge and create git tag
trinity release --direct          # Direct merge (no PR)
```

---

### `trinity skills`

Manage Claude Code skills.

```bash
trinity skills list               # Show installed skills
trinity skills suggest            # Suggest skills based on project
trinity skills add <names...>     # Install skills globally
trinity skills remove <names...>  # Remove skills
trinity skills search <query>     # Search available skills
```

**Example:**
```
$ trinity skills suggest
Based on your project:
  ✓ golang-pro (installed)
  ✓ cli-developer (installed)
  ⚠ microservices-architect (recommended - gRPC detected)
  ⚠ api-designer (recommended - OpenAPI spec found)

$ trinity skills add microservices-architect api-designer
Installing skills globally...
✓ microservices-architect
✓ api-designer
```

---

### `trinity internal`

Internal commands for Claude Code to call. **Not for direct user use.**

```bash
trinity internal complete <story>            # Mark story done
trinity internal add-story <epic> "title"    # Add story to epic
trinity internal log "message"               # Write to activity log
trinity internal learn "content" --tags x,y  # Add learning with tags
trinity internal move-story <from> <to>      # Renumber story, update refs
```

These commands are queued and processed sequentially to avoid write conflicts.

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
