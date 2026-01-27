# CLI Reference

> **Note:** Ralph is written in [Elvish](https://elv.sh). See `docs/gotchas/elvish.md` for language pitfalls.

```bash
elvish ./ralph.elv [OPTIONS]
# or if executable:
./ralph.elv [OPTIONS]
```

## Auto Flags

| Flag | Description |
|------|-------------|
| `--auto-pr` | Auto-create PR without prompting |
| `--auto-merge` | Auto-merge PR without prompting |
| `--auto-clarify` | Auto-proceed on validation questions (make reasonable assumptions) |
| `--auto-handle-duplicates` | Auto-update existing story when duplicate detected |
| `--auto-add-reverse-deps` | Auto-add reverse dependencies when suggested |
| `--auto-update-related` | Auto-apply related story updates (tag-based) |
| `--yolo` | Enable ALL auto flags at once (full autopilot) |

## Control Flags

| Flag | Description |
|------|-------------|
| `--max-iterations <n>` | Max iterations before auto-stop (default: 100) |
| `--base-branch <name>` | Base branch to create story branches from (default: dev) |
| `--timeout <seconds>` | Claude timeout in seconds (default: 1800 = 30 min) |
| `--target-version <ver>` | Only work on stories for specific version (e.g., v1.0) |

## Mode Flags

| Flag | Description |
|------|-------------|
| `--story <ID>` | Work on a specific story (e.g., `1.2.3` or `STORY-1.2.3`) |
| `--one` | Complete one story cycle, then stop cleanly |
| `--resume` | Resume from checkpoint (skips completed phases - see Checkpoints) |
| `--reset` | Reset state and start fresh |
| `--status` | Show PRD status (phases, epics, stories) and exit |
| `--stats` | Show metrics (tokens, durations, costs) and exit |
| `--version-status` | Show version progress and exit |
| `--plan` | Plan mode - output implementation plan without making changes |
| `-q, --quiet` | Quiet mode - hide Claude output, show only Ralph status |
| `-v, --verbose` | Verbose mode - show full prompts, responses, state transitions |

## PRD Management Flags

| Flag | Description |
|------|-------------|
| `--refine-prd [ID]` | Review stories and suggest improvements (all pending or specific story) |
| `--add-stories "desc"` | Generate new stories from a description using Claude |

**Examples:**
```bash
./ralph.elv --refine-prd --target-version v0.1    # Review all pending in v0.1
./ralph.elv --refine-prd 1.2.3 --target-version v1.0  # Refine specific story
./ralph.elv --add-stories "Add OAuth support" --target-version v1.0
```

## Action Flags

| Flag | Description |
|------|-------------|
| `--skip ID "reason"` | Skip a story, allowing dependents to proceed |
| `--retry-clean ID` | Reset story for fresh retry (deletes branch, clears state) |

## Release Flags

| Flag | Description |
|------|-------------|
| `--skip-release` | Skip release workflow when all stories complete |
| `--auto-release` | Auto-release without human approval gate |
| `--release-tag <tag>` | Custom tag name (default: version from PRD, e.g., v1.0) |

## Other Flags

| Flag | Description |
|------|-------------|
| `--no-notifs` | Disable desktop notifications (default: enabled) |
| `-h, --help` | Show help message |

## Checkpoints

Ralph tracks progress at each phase so `--resume` can skip completed work instead of restarting from scratch.

**Stages:** `branch_created` → `validation_complete` → `claude_started` → `claude_complete` → `pr_created`

See the **Recovery & Resume** chapter for full details on checkpoints, resume modes, and common recovery scenarios.
