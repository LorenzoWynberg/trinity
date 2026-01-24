# Ralph Agent - Story {{CURRENT_STORY}}

## Context
Story: {{CURRENT_STORY}} | Branch: {{BRANCH}} | Attempt: {{ATTEMPT}} | Iteration: {{ITERATION}}/{{MAX_ITERATIONS}}

Dependencies (completed): {{DEPENDENCIES}}

{{FEEDBACK}}

## Recent Activity
{{RECENT_ACTIVITY_LOGS}}

## 1. Load Context
Read these files first:
- `scripts/ralph/prd.json` - acceptance criteria for {{CURRENT_STORY}}
- `docs/ARCHITECTURE.md` - system design and patterns
- `docs/COMMANDS.md` - CLI command specifications
- `docs/PROMPTS.md` - prompt system design
- `docs/learnings/` - topic-based patterns and gotchas (check relevant files)
- `CLAUDE.md` - project conventions

If attempt > 1 or refinement: check `git log` and `git diff` for previous work. Focus on the feedback if provided.

## 2. Scope
Implement ONLY {{CURRENT_STORY}}. No refactoring unrelated code. Stay focused on acceptance criteria.

## 3. Implementation
- Write tests when applicable (unit tests for logic)
- Tests go in appropriate `*_test.go` files
- Follow Go conventions (gofmt, effective go)
- Use existing patterns from the codebase

## 4. Verification (Required)
```bash
cd /Users/dev-wynberg/Code/trinity
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
- `scripts/ralph/progress.txt`: APPEND entry with date, changes, learnings (do NOT overwrite)
- `scripts/ralph/prd.json`: Set `"passes": true` for {{CURRENT_STORY}}
  - NOTE: Do NOT set `merged` - Ralph handles that after PR is merged
- `docs/activity/YYYY-MM-DD.md`: APPEND timestamped entry (do NOT overwrite existing content)
  - Read the file first, then add your entry at the end
  - Keep all existing entries from other stories
- `docs/learnings/*.md`: APPEND any new patterns or gotchas (do NOT overwrite)

Then commit and push:
```bash
git add -A
git commit -m "feat: {{CURRENT_STORY}} - <brief description>"
git push -u origin {{BRANCH}}
```

Output: `<story-complete>{{CURRENT_STORY}}</story-complete>`

## 7. On BLOCKED
Don't commit. Don't update prd.json.

Document the blocker:
- `scripts/ralph/progress.txt`: Add what was tried and why blocked

Output: `<story-blocked>{{CURRENT_STORY}}</story-blocked>`

## 8. All Done?
If ALL stories in prd.json have `"merged": true`, output: `<promise>COMPLETE</promise>`

## Important Rules
- No AI attribution in code, comments, or commits
- Keep changes minimal and focused
- Follow existing patterns in the codebase
- Test your changes before marking complete
