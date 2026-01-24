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
- [ ] Add `pr_url` field to `state.json`
- [ ] Create `post-feedback-comment` function
- [ ] Create `post-resolution-comment` function
- [ ] Create `get-all-pr-comments` function
- [ ] Update PR flow to skip PR prompt when `pr_url` exists
- [ ] Update PR description only at merge step
- [ ] Test feedback loop with PR comments

### 2. Automatic Learning Extraction
- [ ] Create `extract-learnings` function in `lib/claude.elv`
- [ ] Create `get-story-activity` helper
- [ ] Create `apply-learnings` parser
- [ ] Integrate into ralph.elv after `<story-complete>`
- [ ] Create initial `docs/learnings/` structure (gotchas.md, patterns.md, conventions.md)
- [ ] Test learning extraction

### 3. Story Validation
- [ ] Create `validate-story` function in `lib/claude.elv`
- [ ] Add `--no-validate` flag to `lib/cli.elv`
- [ ] Integrate validation check before story execution
- [ ] Test with ambiguous story
- [ ] Test with clear story

### 4. Editor-Based Feedback Input
- [ ] Update `get-feedback` function in `lib/pr.elv`
- [ ] Use `$EDITOR` / `$VISUAL` / vim fallback
- [ ] Create temp file with instructions
- [ ] Parse result ignoring comment lines
- [ ] Test editor flow

---

## Phase 2: Polish

### 5. Desktop Notifications
- [ ] Create `notify` function in `lib/ui.elv`
- [ ] Add macOS `osascript` support
- [ ] Add Linux `notify-send` support
- [ ] Add `--notify` flag
- [ ] Trigger on story complete/blocked

### 6. Status Command
- [ ] Add `--status` flag to `lib/cli.elv`
- [ ] Create status display function in `lib/prd.elv`
- [ ] Show phase/epic/story hierarchy
- [ ] Show progress percentage
- [ ] Show current story and branch

### 7. Skip Story Command
- [ ] Add `--skip` flag with story ID and reason
- [ ] Create `skip-story` function in `lib/prd.elv`
- [ ] Update prd.json with skipped status
- [ ] Log to activity
- [ ] Test dependency resolution with skipped story

### 8. YOLO Mode
- [ ] Add `--yolo` flag to `lib/cli.elv`
- [ ] Set no-validate, auto-pr, auto-merge when enabled
- [ ] Add warning message on activation

---

## Phase 3: Robustness

### 9. Pre-flight Checks
- [ ] Create `preflight-checks` function
- [ ] Check clean git state
- [ ] Check base branch is up to date
- [ ] Check required tools (claude, gh, jq, git)
- [ ] Check GitHub auth valid
- [ ] Run on startup before main loop

### 10. Auto-archive Activity Logs
- [ ] Create `archive-old-logs` function
- [ ] Find logs older than 7 days
- [ ] Move to `docs/activity/archive/YYYY-MM/`
- [ ] Run on startup

### 11. Retry Clean Slate
- [ ] Add `--retry-clean STORY-X` flag
- [ ] Delete existing branch (local + remote)
- [ ] Reset story in prd.json (passes=false, attempts=0)
- [ ] Clear state.json

### 12. Configurable Timeouts
- [ ] Add `--timeout N` flag
- [ ] Pass to Claude invocation
- [ ] Update default from 1800s

---

## Phase 4: More Intelligence

### 13. Claude Commit Messages
- [ ] Create `generate-commit-message` function
- [ ] Build prompt with story info + diff
- [ ] Update `prompt.md` to use generated messages
- [ ] Test conventional commit format

### 14. Plan Mode
- [ ] Add `--plan` flag
- [ ] Create plan-only prompt template
- [ ] Disable git commits and file changes
- [ ] Output plan to stdout
- [ ] Test plan output

---

## Phase 5: Observability

### 15. Metrics Tracking
- [ ] Create `lib/metrics.elv` module
- [ ] Create `metrics.json` structure
- [ ] Extract tokens from Claude output
- [ ] Update metrics on story complete
- [ ] Add `--stats` flag
- [ ] Create stats display function

### 16. Verbose Mode
- [ ] Add `--verbose` flag
- [ ] Show full prompts being sent
- [ ] Show raw Claude responses
- [ ] Show state transitions

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

