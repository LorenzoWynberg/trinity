# Ralph Improvements Checklist

Track implementation progress. Update status as features are completed.

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Complete
- [-] Skipped/Deferred

---

## Phase 1: Core Intelligence

### 1. PR Comment-Based Feedback System
- [x] Add `pr_url` field to `state.json`
- [x] Create `post-feedback-comment` function
- [x] Create `post-resolution-comment` function
- [x] Create `get-all-pr-comments` function
- [x] Update PR flow to skip PR prompt when `pr_url` exists
- [x] Update PR description only at merge step
- [ ] Test feedback loop with PR comments

### 2. Automatic Learning Extraction
- [x] Create `extract-learnings` function in `lib/claude.elv`
- [x] Create `get-story-activity` helper (inline in function)
- [x] Create `apply-learnings` parser (inline in function)
- [x] Integrate into ralph.elv after `<story-complete>`
- [x] Create initial `docs/learnings/` structure (gotchas.md, patterns.md, conventions.md)
- [ ] Test learning extraction

### 3. Story Validation
- [x] Create `validate-story` function in `lib/claude.elv`
- [x] Add `--no-validate` flag to `lib/cli.elv`
- [x] Integrate validation check before story execution
- [ ] Test with ambiguous story
- [ ] Test with clear story

### 4. Editor-Based Feedback Input
- [x] Update `get-feedback` function in `lib/pr.elv`
- [x] Use `$EDITOR` / `$VISUAL` / vim fallback
- [x] Create temp file with instructions
- [x] Parse result ignoring comment lines
- [ ] Test editor flow

---

## Phase 2: Polish

### 5. Desktop Notifications
- [x] Create `notify` function in `lib/ui.elv`
- [x] Add macOS `osascript` support
- [x] Add Linux `notify-send` support
- [x] Add `--notify` flag
- [x] Trigger on story complete/blocked

### 6. Status Command
- [x] Add `--status` flag to `lib/cli.elv`
- [x] Create status display function in `lib/prd.elv`
- [x] Show phase/epic/story hierarchy
- [x] Show progress percentage
- [x] Show current story and branch

### 7. Skip Story Command
- [x] Add `--skip` flag with story ID and reason
- [x] Create `skip-story` function in `lib/prd.elv`
- [x] Update prd.json with skipped status
- [x] Log to activity
- [ ] Test dependency resolution with skipped story

### 8. YOLO Mode
- [x] Add `--yolo` flag to `lib/cli.elv`
- [x] Set no-validate, auto-pr, auto-merge when enabled
- [x] Add warning message on activation

---

## Phase 3: Robustness

### 9. Pre-flight Checks
- [x] Create `preflight-checks` function
- [x] Check clean git state
- [x] Check base branch is up to date
- [x] Check required tools (claude, gh, jq, git)
- [x] Check GitHub auth valid
- [x] Run on startup before main loop

### 10. Auto-archive Activity Logs
- [x] Create `archive-old-logs` function
- [x] Find logs older than 7 days
- [x] Move to `logs/activity/archive/YYYY-MM/`
- [x] Run on startup

### 11. Retry Clean Slate
- [x] Add `--retry-clean STORY-X` flag
- [x] Delete existing branch (local + remote)
- [x] Reset story in prd.json (passes=false, attempts=0)
- [x] Clear state.json

### 12. Configurable Timeouts
- [x] Add `--timeout N` flag
- [x] Pass to Claude invocation (via claude-timeout config)
- [x] Default remains 1800s

---

## Phase 4: More Intelligence

### 13. Claude Commit Messages
- [x] Create `generate-commit-message` function
- [x] Build prompt with story info + diff
- [x] Update `prompt.md` to use generated messages
- [x] Test conventional commit format

### 14. Plan Mode
- [x] Add `--plan` flag
- [x] Create plan-only prompt template
- [x] Disable git commits and file changes
- [x] Output plan to stdout
- [x] Test plan output

---

## Phase 5: Observability

### 15. Metrics Tracking
- [x] Create `lib/metrics.elv` module
- [x] Create `metrics.json` structure
- [x] Extract tokens from Claude output
- [x] Update metrics on story complete
- [x] Add `--stats` flag
- [x] Create stats display function

### 16. Verbose Mode
- [x] Add `--verbose` flag
- [x] Show full prompts being sent
- [x] Show raw Claude responses
- [x] Show state transitions

---

## v2 (Future)

### Webhook/Slack Notifications
- [ ] Add `RALPH_WEBHOOK_URL` env var support
- [ ] Create `post-webhook` function
- [ ] Define event types
- [ ] Trigger on key events

---

## Notes

_Add implementation notes, blockers, or decisions here as you work._

---

## Completed

_Move completed items here with date for reference._

