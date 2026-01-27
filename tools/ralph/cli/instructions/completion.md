# Completion Instructions

## Signal File

**IMPORTANT:** At the end of your work, write a signal file so Ralph knows the outcome.

Write to: `tools/ralph/cli/signal.json`

## On SUCCESS

Update these files:
- `docs/gotchas/*.md`: Add any NEW gotchas to the appropriate topic file
- `tools/ralph/cli/progress.txt`: APPEND entry with date, changes, gotchas
- `tools/ralph/cli/prd.json`: Set `"passes": true` for {{CURRENT_STORY}}
  - NOTE: Do NOT set `merged` - Ralph handles that after PR is merged
- `logs/activity/trinity/YYYY-MM-DD.md`: Update with completed work, files modified, decisions made

Then commit and push (no Co-Authored-By lines):
```bash
git add -A
git commit -m "$(cat <<'EOF'
type(scope): brief description of {{CURRENT_STORY}}

- Key change 1
- Key change 2
EOF
)"
git push -u origin {{BRANCH}}
```

**Commit message format (conventional commits):**
- **type**: feat (new feature), fix (bug fix), refactor, test, docs, chore
- **scope**: optional area (cli, core, ralph, etc.)
- **description**: imperative, lowercase, no period, under 72 chars
- **body**: 2-4 bullet points of significant changes

**Write signal file:**
```json
{
  "status": "complete",
  "story_id": "{{CURRENT_STORY}}",
  "files_changed": ["list", "of", "modified", "files"],
  "tests_passed": true,
  "message": null
}
```

## On BLOCKED

Don't commit. Don't update prd.json.

**Still capture gotchas from failure:**
- `docs/gotchas/*.md`: Add what you learned to the appropriate file
- `tools/ralph/cli/progress.txt`: APPEND what was tried and why blocked
- `logs/activity/trinity/YYYY-MM-DD.md`: Detailed blocker info and what was attempted

Failures are valuable learning opportunities - don't lose them!

**Write signal file:**
```json
{
  "status": "blocked",
  "story_id": "{{CURRENT_STORY}}",
  "files_changed": [],
  "tests_passed": false,
  "message": "Explain why blocked and what was tried"
}
```

## All Done?

If ALL stories in prd.json have `"merged": true`, set status to `"all_complete"`:
```json
{
  "status": "all_complete",
  "story_id": "{{CURRENT_STORY}}",
  "files_changed": [],
  "tests_passed": true,
  "message": "All stories merged"
}
```
