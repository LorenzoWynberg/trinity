# Completion Instructions

## On SUCCESS

Update these files:
- `docs/learnings/*.md`: Add any NEW learnings to the appropriate topic file
- `tools/ralph/cli/progress.txt`: APPEND entry with date, changes, learnings
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

Output: `<story-complete>{{CURRENT_STORY}}</story-complete>`

## On BLOCKED

Don't commit. Don't update prd.json.

**Still capture learnings from failure:**
- `docs/learnings/*.md`: Add what you learned to the appropriate file's **Gotchas** section
- `tools/ralph/cli/progress.txt`: APPEND what was tried and why blocked
- `logs/activity/trinity/YYYY-MM-DD.md`: Detailed blocker info and what was attempted

Failures are valuable learning opportunities - don't lose them!

Output: `<story-blocked>{{CURRENT_STORY}}</story-blocked>`

## All Done?

If ALL stories in prd.json have `"merged": true`, output: `<promise>COMPLETE</promise>`
