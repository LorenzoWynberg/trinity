# Completion

## On SUCCESS

### 1. Update Documentation

**Gotchas** (`docs/gotchas/<book>/`):
- Add any new pitfalls discovered
- Correct any wrong docs you found
- Remove outdated info

**Knowledge** (`docs/knowledge/<book>/`):
- Add new features or patterns documented

If correcting a misconception, note it in the activity log.

### 2. Update Files

- `tools/ralph/cli/progress.txt` - APPEND entry with date, changes
- `tools/ralph/cli/prd/{{VERSION}}.json` - Set `"passes": true` for {{CURRENT_STORY}}
  - Do NOT set `merged` - Ralph handles that after PR merge
- `logs/activity/trinity/YYYY-MM-DD.md` - See `instructions/activity-log.md`

### 3. Commit and Push

```bash
git add -A
git commit -m "$(cat <<'EOF'
type(scope): brief description

- Key change 1
- Key change 2
EOF
)"
git push -u origin {{BRANCH}}
```

**Commit types:** feat, fix, refactor, test, docs, chore
**No AI attribution** in commit messages.

### 4. Write Signal

`tools/ralph/cli/signal.json`:
```json
{
  "status": "complete",
  "story_id": "{{CURRENT_STORY}}",
  "files_changed": ["list", "of", "files"],
  "tests_passed": true,
  "message": null
}
```

---

## On BLOCKED

Don't commit. Don't update prd.json.

**Still capture learnings:**
- `docs/gotchas/` - Add what you learned
- `tools/ralph/cli/progress.txt` - What was tried, why blocked
- Activity log - Detailed blocker info

**Write signal:**
```json
{
  "status": "blocked",
  "story_id": "{{CURRENT_STORY}}",
  "files_changed": [],
  "tests_passed": false,
  "message": "Why blocked and what was tried"
}
```

---

## All Stories Done?

If ALL stories in prd.json have `"merged": true`:
```json
{
  "status": "all_complete",
  "story_id": "{{CURRENT_STORY}}",
  "files_changed": [],
  "tests_passed": true,
  "message": "All stories merged"
}
```
