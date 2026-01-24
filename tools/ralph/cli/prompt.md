# Ralph Agent - Story {{CURRENT_STORY}}

## Context
Version: {{VERSION}} | Story: {{CURRENT_STORY}} | Branch: {{BRANCH}} | Attempt: {{ATTEMPT}} | Iteration: {{ITERATION}}/{{MAX_ITERATIONS}}

Dependencies (completed): {{DEPENDENCIES}}

{{FEEDBACK}}

## 1. Load Context
Read these files first:
- `tools/ralph/cli/prd/{{VERSION}}.json` - acceptance criteria for {{CURRENT_STORY}}
- `docs/ARCHITECTURE.md` - system design and patterns
- `docs/COMMANDS.md` - CLI command specifications
- `docs/PROMPTS.md` - prompt system design
- `docs/learnings/` - **read relevant files** based on task:
  - `go.md` - Go patterns, workspaces, modules
  - `ralph.md` - Ralph patterns, streaming, state
- `tools/ralph/cli/progress.txt` - story history
- `CLAUDE.md` - project conventions

If attempt > 1 or refinement: check `git log` and `git diff` for previous work. Focus on the feedback if provided.

**Activity Log:** Create or update `logs/activity/YYYY-MM-DD.md` (today's date). Add entry for starting work on {{VERSION}} / {{CURRENT_STORY}}. Include version in headers (e.g., "## {{VERSION}} - {{CURRENT_STORY}}: Title"). Before archiving old logs: extract learnings to `docs/learnings/`. Archive logs older than 7 days to `logs/activity/archive/YYYY-MM/`.

### Recent Activity Logs (Detailed Context)
Review these recent activity logs for detailed context on recent work:

{{RECENT_ACTIVITY_LOGS}}

**Learning Loop:** After completing {{CURRENT_STORY}}:
1. **Add** new learnings to the appropriate file in `docs/learnings/`
2. **Correct** any existing learnings you discover were wrong or incomplete
3. **Remove** outdated info that no longer applies

If correcting a misconception, note it briefly in the activity log so we know what changed and why.

## 2. Scope
Implement ONLY {{CURRENT_STORY}}. No refactoring unrelated code. Note other issues in Learnings only.

## 3. Implementation
- Write tests when applicable (unit tests for logic)
- Tests go in appropriate `*_test.go` files
- Follow Go conventions (gofmt, effective go)
- Use existing patterns from the codebase

## 4. Verification (Required)
```bash
cd /Users/dev-wynberg/Code/trinity-ai-labs/trinity
go work sync
go build ./cli/cmd/trinity 2>&1 || true
go test ./... 2>&1 || true
```

Build must pass. Tests should pass (create them if they don't exist).

## 5. Self-Review (Max 3 cycles)
After build passes, ask: "What's missing or could improve?"
- Edge cases, API design, code organization, error handling
- Only implement if: in scope, meaningful, aligns with acceptance criteria
- Atomic commits per fix, re-run build after each

## 6. On SUCCESS

Update these files:
- `docs/learnings/*.md`: Add any NEW learnings to the appropriate topic file
- `tools/ralph/cli/progress.txt`: APPEND entry with date, changes, learnings
- `tools/ralph/cli/prd.json`: Set `"passes": true` for {{CURRENT_STORY}}
  - NOTE: Do NOT set `merged` - Ralph handles that after PR is merged
- `logs/activity/YYYY-MM-DD.md`: Update with completed work, files modified, decisions made

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

## 7. On BLOCKED
Don't commit. Don't update prd.json.

**Still capture learnings from failure:**
- `docs/learnings/*.md`: Add what you learned to the appropriate file's **Gotchas** section
- `tools/ralph/cli/progress.txt`: APPEND what was tried and why blocked
- `logs/activity/YYYY-MM-DD.md`: Detailed blocker info and what was attempted

Failures are valuable learning opportunities - don't lose them!

Output: `<story-blocked>{{CURRENT_STORY}}</story-blocked>`

## 8. All Done?
If ALL stories in prd.json have `"merged": true`, output: `<promise>COMPLETE</promise>`

## Important Rules
- No AI attribution in code, comments, or commits
- Keep changes minimal and focused
- Follow existing patterns in the codebase
- Test your changes before marking complete
- APPEND to activity/progress files, never overwrite
