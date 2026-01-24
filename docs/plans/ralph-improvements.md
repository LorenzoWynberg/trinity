# Ralph Improvements Plan

This document outlines planned improvements to the Ralph autonomous development loop.

## Current State

Ralph is a working autonomous dev loop with:
- Story selection with dependency resolution
- Claude execution with streaming output
- PR creation/merge flow with user prompts
- State persistence and crash recovery
- Activity log injection for context
- Feedback loop for requesting changes
- Claude-generated PR descriptions
- `--auto-pr` and `--auto-merge` flags

## Planned Improvements

---

## High Impact

### 1. Editor-based Feedback Input

**Problem:** Current "Enter twice to finish" is clunky and error-prone.

**Solution:** Open user's preferred editor for feedback input.

**Implementation:**
```elvish
fn get-feedback {
  var tmp = (mktemp --suffix=.md)
  echo "# Enter feedback for Claude" > $tmp
  echo "# Lines starting with # are ignored" >> $tmp
  echo "# Save and close to submit, empty file to cancel" >> $tmp
  echo "" >> $tmp

  # Open editor (falls back through options)
  var editor = (or $E:EDITOR $E:VISUAL "vim")
  $editor $tmp </dev/tty >/dev/tty

  # Parse result, ignoring comments
  var content = (grep -v '^#' $tmp | str:trim-space (slurp))
  rm -f $tmp
  put $content
}
```

**Files:** `scripts/ralph/lib/pr.elv`

**Effort:** 15 min

---

### 2. Claude-Generated Commit Messages

**Problem:** Current commit messages are basic: `feat: STORY-X.Y.Z - <brief description>`

**Solution:** Have Claude analyze the diff and generate meaningful commit messages.

**Implementation:**
- Add `generate-commit-message` function to `lib/claude.elv`
- Prompt includes: story info, diff, acceptance criteria
- Format: conventional commits with scope
- Update `prompt.md` to call internal command instead of hardcoded format

**Prompt Template:**
```markdown
Generate a commit message for this change.

STORY: {{STORY_ID}} - {{STORY_TITLE}}

DIFF:
{{GIT_DIFF}}

Format: conventional commit
- type(scope): description
- blank line
- body explaining what and why (not how)

Types: feat, fix, refactor, docs, test, chore

Output ONLY the commit message, no explanation.
```

**Files:**
- `scripts/ralph/lib/claude.elv`
- `scripts/ralph/prompt.md`

**Effort:** 1 hour

---

### 3. PR Review Comment Integration

**Problem:** If PR gets review comments on GitHub, user must manually copy them as feedback.

**Solution:** Auto-fetch PR review comments and inject as feedback.

**Implementation:**
```elvish
fn get-pr-review-comments {|branch-name|
  var comments = ""
  try {
    # Get review comments
    set comments = (gh pr view $branch-name --json reviews,comments --jq '
      [.reviews[].body, .comments[].body] | map(select(. != "")) | join("\n\n---\n\n")
    ' | slurp)
  } catch _ { }
  put $comments
}

# In run-flow, before merge prompt:
var review-comments = (get-pr-review-comments $branch-name)
if (not (eq $review-comments "")) {
  ui:status "PR has review comments:" > /dev/tty
  echo $review-comments > /dev/tty
  echo "" > /dev/tty
  ui:status "Include as feedback? [Y/n]" > /dev/tty
  # ...
}
```

**New Flag:** `--resume-from-pr` - Fetches PR comments as feedback automatically

**Files:** `scripts/ralph/lib/pr.elv`

**Effort:** 1 hour

---

### 4. Cost/Token Tracking

**Problem:** No visibility into Claude API usage and costs.

**Solution:** Track tokens per story and provide cost estimates.

**Implementation:**

Add to `state.json`:
```json
{
  "token_usage": {
    "STORY-1.1.2": {
      "runs": [
        {
          "timestamp": "2026-01-24T10:30:00Z",
          "input_tokens": 5000,
          "output_tokens": 2000,
          "duration_seconds": 180
        }
      ],
      "total_input": 5000,
      "total_output": 2000
    }
  }
}
```

Parse from Claude's stream-json output:
```elvish
# Extract usage from result message
jq -r 'select(.type == "result") | .usage | "\(.input_tokens)\t\(.output_tokens)"'
```

Add `--stats` flag to show usage:
```
$ ./ralph.elv --stats

Token Usage Summary:
  STORY-1.1.1: 12,000 in / 4,500 out (~$0.25)
  STORY-1.1.2: 8,000 in / 3,000 out (~$0.18)
  Total: 20,000 in / 7,500 out (~$0.43)
```

**Files:**
- `scripts/ralph/lib/state.elv`
- `scripts/ralph/lib/claude.elv`
- `scripts/ralph/ralph.elv`

**Effort:** 2 hours

---

### 5. Skip Story Command

**Problem:** No way to skip a problematic story without blocking dependents.

**Solution:** Add skip functionality that marks story as skipped and updates dependencies.

**Implementation:**
```bash
./ralph.elv --skip STORY-1.2.3 "Blocked by external API not ready"
```

```elvish
fn skip-story {|story-id reason|
  # Update prd.json
  jq '(.stories[] | select(.id == "'$story-id'")) |= . + {
    skipped: true,
    skip_reason: "'$reason'",
    passes: true,      # Allow dependents to proceed
    merged: true       # Treat as complete for deps
  }' $prd-file > $tmp && mv $tmp $prd-file

  # Log to activity
  echo "## Skipped: "$story-id >> $activity-file
  echo "Reason: "$reason >> $activity-file
}
```

**Files:**
- `scripts/ralph/lib/prd.elv`
- `scripts/ralph/lib/cli.elv`
- `scripts/ralph/ralph.elv`

**Effort:** 30 min

---

## Medium Impact

### 6. Desktop Notifications

**Problem:** User doesn't know when story completes if AFK.

**Solution:** Send desktop notification on story complete/blocked.

**Implementation:**
```elvish
fn notify {|title message|
  if (has-external osascript) {
    # macOS
    osascript -e 'display notification "'$message'" with title "'$title'"' 2>/dev/null
  } elif (has-external notify-send) {
    # Linux
    notify-send $title $message 2>/dev/null
  }
}

# Usage
notify "Ralph" "Story STORY-1.1.2 completed!"
notify "Ralph" "Story STORY-1.2.3 BLOCKED"
```

**Flag:** `--notify` to enable (off by default)

**Files:**
- `scripts/ralph/lib/ui.elv`
- `scripts/ralph/ralph.elv`

**Effort:** 15 min

---

### 7. Dry Run Mode

**Problem:** No way to preview what Claude would do without making changes.

**Solution:** Add dry-run mode that shows plan without executing.

**Implementation:**
```bash
./ralph.elv --dry-run
```

- Runs Claude with modified prompt asking for plan only
- No git commits, no PRs, no file changes
- Outputs: files to modify, approach, estimated scope

**Prompt addition:**
```markdown
DRY RUN MODE: Do not make any changes.
Instead, output a plan:
1. Files you would create/modify
2. Approach you would take
3. Potential risks or blockers
```

**Files:**
- `scripts/ralph/lib/cli.elv`
- `scripts/ralph/lib/claude.elv`
- `scripts/ralph/prompt.md`

**Effort:** 1 hour

---

### 8. Auto-archive Activity Logs

**Problem:** Activity logs pile up, prompt mentions archiving but it's manual.

**Solution:** Auto-archive logs older than 7 days on Ralph startup.

**Implementation:**
```elvish
fn archive-old-logs {
  var activity-dir = (path:join $project-root "docs" "activity")
  var archive-dir = (path:join $activity-dir "archive")
  var cutoff = (date -d "7 days ago" +%Y-%m-%d)

  for f [(ls $activity-dir)] {
    if (re:match '^\d{4}-\d{2}-\d{2}\.md$' $f) {
      var file-date = (str:trim-suffix ".md" $f)
      if (< $file-date $cutoff) {
        var month = (str:join "-" $file-date[0:7])
        mkdir -p (path:join $archive-dir $month)
        mv (path:join $activity-dir $f) (path:join $archive-dir $month $f)
        ui:dim "Archived: "$f
      }
    }
  }
}
```

Run on startup before main loop.

**Files:**
- `scripts/ralph/lib/claude.elv` (or new `lib/activity.elv`)
- `scripts/ralph/ralph.elv`

**Effort:** 20 min

---

### 9. Status/Dependency Visualization

**Problem:** Hard to see overall progress and what's blocked.

**Solution:** Add `--status` command with visual dependency graph.

**Implementation:**
```bash
./ralph.elv --status
```

Output:
```
Ralph Status
============

Phase 1: MVP Foundation
  Epic 1.1: Project Setup
    [x] STORY-1.1.1: Create Go workspace structure (merged: abc123)
    [>] STORY-1.1.2: Create CLI entrypoint (in progress, attempt 2)
    [ ] STORY-1.1.3: Add config loading (blocked by: 1.1.2)

  Epic 1.2: Core Loop
    [ ] STORY-1.2.1: Implement PRD parser (blocked by: 1.1.2, 1.1.3)
    [ ] STORY-1.2.2: Add Claude invocation (blocked by: 1.2.1)

Progress: 1/15 stories merged (6%)
Current: STORY-1.1.2 on branch feat/story-1.1.2

Legend: [x] merged  [>] in progress  [ ] pending  [!] blocked  [-] skipped
```

**Files:**
- `scripts/ralph/lib/prd.elv`
- `scripts/ralph/lib/cli.elv`
- `scripts/ralph/ralph.elv`

**Effort:** 1.5 hours

---

### 10. Webhook/Slack Notifications

**Problem:** Team visibility into Ralph progress.

**Solution:** Post updates to Slack or webhook on key events.

**Implementation:**
```elvish
var webhook-url = $E:RALPH_WEBHOOK_URL

fn post-webhook {|event payload|
  if (not (eq $webhook-url "")) {
    curl -X POST $webhook-url \
      -H "Content-Type: application/json" \
      -d '{"event": "'$event'", "payload": '$payload'}' \
      2>/dev/null &
  }
}

# Events: story_started, story_completed, story_blocked, pr_created, pr_merged
```

**Files:**
- New `scripts/ralph/lib/notify.elv`
- `scripts/ralph/ralph.elv`

**Effort:** 1 hour

---

## Quick Wins

### 11. Configurable Timeouts

**Current:** Hardcoded 1800s (30 min) for Claude.

**Solution:** Make configurable via flag:
```bash
./ralph.elv --timeout 3600  # 1 hour
```

**Effort:** 10 min

---

### 12. Verbose Mode

**Current:** Either quiet or streaming.

**Solution:** Add `--verbose` for extra debugging info:
- Show full prompts being sent
- Show raw Claude responses
- Show state transitions

**Effort:** 20 min

---

### 13. Story Retry with Clean Slate

**Current:** Resume continues from existing branch state.

**Solution:** Add `--retry-clean STORY-X` to:
- Delete existing branch
- Reset story state (passes=false, attempts=0)
- Start fresh

**Effort:** 20 min

---

### 14. Pre-flight Checks

**Current:** Jumps straight into story execution.

**Solution:** Before starting, verify:
- Clean git state (no uncommitted changes)
- Base branch is up to date
- Required tools have correct versions
- GitHub auth is valid

**Effort:** 30 min

---

## Implementation Priority

### Phase 1: Polish (This Week)
1. Editor-based feedback input (15 min)
2. Desktop notifications (15 min)
3. Status command (1.5 hr)
4. Skip story command (30 min)

### Phase 2: Robustness (Next Week)
5. Pre-flight checks (30 min)
6. Auto-archive logs (20 min)
7. Retry clean slate (20 min)
8. Configurable timeouts (10 min)

### Phase 3: Intelligence (Following Week)
9. Claude commit messages (1 hr)
10. PR review integration (1 hr)
11. Dry run mode (1 hr)

### Phase 4: Observability (Later)
12. Token tracking (2 hr)
13. Webhook notifications (1 hr)
14. Verbose mode (20 min)

---

## Open Questions

1. **Parallel execution:** Should we support running multiple stories in parallel using git worktrees? High complexity but big time savings.

2. **Story validation:** Should Claude pre-validate that acceptance criteria are clear before starting? Could catch ambiguous stories early.

3. **Rollback mechanism:** If a merged story breaks something, how do we handle rollback? Revert commit + re-open story?

4. **Learning extraction:** Can we automatically suggest learnings to add based on what Claude did? Pattern detection from activity logs.

5. **Branch strategy:** Current assumption is all features branch from and merge to base branch. What about feature branches that depend on other un-merged feature branches?

---

## Success Metrics

After implementing improvements, measure:
- Average story completion time
- Feedback loop iterations per story
- Stories blocked rate
- Token usage per story
- User intervention frequency
