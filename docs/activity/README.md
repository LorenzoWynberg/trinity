# Activity Logs

Daily activity logs tracking Ralph's autonomous development work.

## Format

Each log is named `YYYY-MM-DD.md` and contains timestamped entries:

```markdown
# Activity Log - 2024-01-23

## 14:30 - Started STORY-1.1.2
- Task: Create CLI entrypoint with Cobra
- Branch: feat/story-1.1.2

## 15:45 - Completed STORY-1.1.2
- Created cli/cmd/trinity/main.go
- Added root command with help text
- Tests passing

## Learnings
- Cobra requires cmd.Execute() in main()
- Use cobra-cli for scaffolding new commands
```

## Usage

Ralph automatically:
1. Reads the 2 most recent logs for context
2. Includes them in Claude's prompt via `{{RECENT_ACTIVITY_LOGS}}`
3. Claude updates the current day's log with progress

## Archiving

Logs older than 7 days should be archived to `archive/YYYY-MM/`. Before archiving, extract useful learnings to `docs/learnings/`.
