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
| `--auto-clarify` | Auto-proceed on validation questions |
| `--auto-handle-duplicates` | Auto-update existing story when duplicate detected |
| `--auto-add-reverse-deps` | Auto-add reverse dependencies when suggested |
| `--auto-update-related` | Auto-apply related story updates (tag-based) |
| `--yolo` | Enable ALL auto flags at once |

## Control Flags

| Flag | Description |
|------|-------------|
| `--max-iterations <n>` | Max iterations before auto-stop (default: 100) |
| `--base-branch <name>` | Base branch for story branches (default: dev) |
| `--timeout <seconds>` | Claude timeout (default: 1800) |
| `--target-version <ver>` | Only work on stories for specific version |

## Mode Flags

| Flag | Description |
|------|-------------|
| `--story <ID>` | Work on a specific story (checks deps first) |
| `--one` | Complete one story cycle, then stop |
| `--resume` | Resume from last state |
| `--reset` | Reset state and start fresh |
| `--status` | Show PRD status and exit |
| `--stats` | Show metrics and exit |
| `--version-status` | Show version progress and exit |
| `--plan` | Plan mode (read-only, no changes) |
| `-q, --quiet` | Hide Claude output |
| `-v, --verbose` | Show full prompts/responses |

## Action Flags

| Flag | Description |
|------|-------------|
| `--skip ID "reason"` | Skip a story |
| `--retry-clean ID` | Reset story for retry |

## Release Flags

| Flag | Description |
|------|-------------|
| `--skip-release` | Skip release workflow |
| `--auto-release` | Auto-release without human gate |
| `--release-tag <tag>` | Custom release tag name |

## Other Flags

| Flag | Description |
|------|-------------|
| `--no-notifs` | Disable notifications (default: on) |
| `-h, --help` | Show help |
