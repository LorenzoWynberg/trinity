## 1. Load Context
Read these files first:
- `tools/ralph/cli/prd/{{VERSION}}.json` - acceptance criteria for {{CURRENT_STORY}}
- `docs/ARCHITECTURE.md` - system design and patterns
- `docs/COMMANDS.md` - CLI command specifications
- `docs/PROMPTS.md` - prompt system design
- `tools/ralph/cli/progress.txt` - story history
- `CLAUDE.md` - project conventions

**Knowledge Base** (`docs/knowledge/<book>/`) - read relevant books:
- `ralph/` - CLI workflow, state management, PRD features (check `index.json` for chapters)
- `dashboard/` - Dashboard architecture, terminal, themes
- `trinity/` - Trinity CLI overview
- `go/` - Go workspaces, multi-module setup

**Gotchas** (`docs/gotchas/<book>/`) - read to avoid pitfalls:
- `elvish/` - Elvish shell pitfalls
- `dashboard/` - React/Next.js hydration, mobile issues
- `go/` - Go module path, workspace sync timing
- `patterns/` - Reusable patterns
- `conventions/` - Coding standards

Each book is a folder with `index.json` (metadata) and `.md` chapters.

If attempt > 1 or refinement: check `git log` and `git diff` for previous work. Focus on the feedback if provided.

**Activity Log:** Create or update `logs/activity/trinity/YYYY-MM-DD.md` (today's date) using this template:

```markdown
## {{CURRENT_STORY}}: [Story Title from PRD]

**Phase:** [phase number] | **Epic:** [epic number] | **Version:** {{VERSION}}
**Started:** [current timestamp, e.g., 2026-01-24 17:30]
**Branch:** {{BRANCH}}

### What was done
- [Change 1]
- [Change 2]

### Files modified
- `path/to/file.go` - Description of changes

### Acceptance criteria met
- [x] Criterion 1
- [x] Criterion 2

### Learnings
- [Any gotchas, patterns, or insights discovered]

---
```

Before archiving old logs: extract gotchas to `docs/gotchas/`. Archive logs older than 7 days to `logs/activity/trinity/archive/YYYY-MM/`.

### Recent Activity Logs (Detailed Context)
Review these recent activity logs for detailed context on recent work:

{{RECENT_ACTIVITY_LOGS}}

**Documentation Loop:** After completing work:
1. **Add** new gotchas or knowledge to the appropriate book in `docs/gotchas/` or `docs/knowledge/`
2. **Correct** any existing docs you discover were wrong or incomplete
3. **Remove** outdated info that no longer applies
4. **Add chapters** if needed: create `.md` file and add to book's `index.json`

If correcting a misconception, note it briefly in the activity log so we know what changed and why.

## 2. Scope
Implement ONLY what is requested. No refactoring unrelated code. Note other issues in Learnings only.

**Task Tracking:** For non-trivial work, break into tracked tasks before starting. Use TaskCreate to plan steps, TaskUpdate to mark progress.

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
- Only implement if: in scope, meaningful, aligns with requirements
- Atomic commits per fix, re-run build after each

## 6. On SUCCESS

Update these files:
- `docs/gotchas/<book>/`: Add any NEW gotchas to the appropriate book
- `docs/knowledge/<book>/`: Add any NEW knowledge/features documented
- `tools/ralph/cli/progress.txt`: APPEND entry with date, changes, gotchas
- `logs/activity/trinity/YYYY-MM-DD.md`: Update with completed work, files modified, decisions made

Then commit and push (no Co-Authored-By lines):
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

**Commit message format (conventional commits):**
- **type**: feat (new feature), fix (bug fix), refactor, test, docs, chore
- **scope**: optional area (cli, core, ralph, etc.)
- **description**: imperative, lowercase, no period, under 72 chars
- **body**: 2-4 bullet points of significant changes

Output: `<story-complete>{{CURRENT_STORY}}</story-complete>`

## 7. On BLOCKED
Don't commit. Don't update prd.json.

**Still capture gotchas from failure:**
- `docs/gotchas/<book>/`: Add what you learned to the appropriate book
- `tools/ralph/cli/progress.txt`: APPEND what was tried and why blocked
- `logs/activity/trinity/YYYY-MM-DD.md`: Detailed blocker info and what was attempted

Failures are valuable learning opportunities - don't lose them!

Output: `<story-blocked>{{CURRENT_STORY}}</story-blocked>`

## Important Rules
- No AI attribution in code, comments, or commits
- Keep changes minimal and focused
- Follow existing patterns in the codebase
- Test your changes before marking complete
- APPEND to activity/progress files, never overwrite
