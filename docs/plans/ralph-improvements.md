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

### 3. PR Comment-Based Feedback System

**Problem:**
- Feedback given to Ralph is invisible on GitHub
- PR reviews on GitHub require manual copy/paste into Ralph
- No audit trail of feedback loops

**Solution:** Use PR comments as the source of truth for all feedback:

1. When user gives feedback → post as PR comment (free)
2. When Claude fixes → post resolution comment (free)
3. GitHub reviews also appear as comments → Ralph reads them
4. PR description only updated at merge time (one Claude call)

**Flow:**
```
Story completes → Create PR (Claude generates initial description)
User picks [f]eedback → Post as PR comment: "**Feedback Requested:** ..."
Claude fixes → Post resolution: "**Changes Applied:** ..."
Loop as needed... (all comments, no Claude calls)
User picks [y]es merge → Update PR description (one Claude call) → Merge
```

**State Tracking:**
Add `pr_url` to state.json so feedback loop skips PR prompt:
```json
{
  "current_story": "STORY-1.1.2",
  "branch": "feat/story-1.1.2",
  "pr_url": "https://github.com/foo/bar/pull/42",
  "status": "in_progress"
}
```

**Token Efficiency:**
| Action | Tokens |
|--------|--------|
| Initial PR description | Claude call |
| Post feedback comment | Free (gh cli) |
| Post resolution comment | Free (gh cli) |
| Read all PR comments | Free (gh cli) |
| Update description at merge | Claude call |

5 feedback rounds = 2 Claude calls (not 6)

**Implementation:**
```elvish
# Post feedback as PR comment
fn post-feedback-comment {|branch-name feedback|
  gh pr comment $branch-name --body "**Feedback Requested:**\n\n"$feedback
}

# Post resolution after Claude fixes
fn post-resolution-comment {|branch-name summary|
  gh pr comment $branch-name --body "**Changes Applied:**\n\n"$summary
}

# Get ALL PR comments (feedback + reviews)
fn get-all-pr-comments {|branch-name|
  gh pr view $branch-name --json comments,reviews --jq '...'
}

# Claude prompt for PR description reads comments to summarize feedback addressed
```

**What the PR Looks Like:**
```markdown
PR #42: STORY-1.1.2 - Create CLI entrypoint

## Summary
...

---
💬 @ralph-bot: **Feedback Requested:** Add error handling for nil case

💬 @ralph-bot: **Changes Applied:** Added nil check at cli/cmd/root.go:45

💬 @teammate: Can we also add a --verbose flag?

💬 @ralph-bot: **Feedback Requested:** Add --verbose flag

💬 @ralph-bot: **Changes Applied:** Added --verbose flag with debug output
```

**Files:**
- `scripts/ralph/lib/pr.elv` - Comment functions, state-based flow
- `scripts/ralph/lib/state.elv` - Add pr_url field
- `scripts/ralph/ralph.elv` - Pass pr_url to run-flow

**Effort:** 2 hours

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

### 5. Automatic Learning Extraction

**Problem:** Claude discovers patterns and gotchas while working but often forgets to document them. Knowledge gets lost.

**Solution:** After each story completes, automatically analyze what Claude did and suggest learnings.

**Trigger:** Runs automatically when a story reaches `<story-complete>` signal, before PR flow.

**Implementation:**
```elvish
fn extract-learnings {|story-id|
  # Get the activity log entry for this story
  var activity = (get-story-activity $story-id)

  # Get the diff for this story
  var diff = (git diff $base-branch...$branch-name)

  # Get existing learnings for context
  var existing = (cat docs/learnings/*.md | slurp)

  var prompt = "Analyze this completed story and extract learnings.

STORY: "$story-id"

ACTIVITY LOG:
"$activity"

CHANGES MADE:
"$diff"

EXISTING LEARNINGS (don't duplicate):
"$existing"

Look for:
- Gotchas or surprises encountered
- Patterns that would help future stories
- Project-specific conventions discovered
- Mistakes made and corrected

Output format:
<no-learnings/> if nothing notable

OR

<learning file=\"gotchas.md\">
Content to append...
</learning>

Only extract genuinely useful, non-obvious learnings."

  var result = (echo $prompt | claude --dangerously-skip-permissions --print)

  # Parse and apply learnings
  if (not (str:contains $result "<no-learnings/>")) {
    # Extract and append to appropriate files
    apply-learnings $result
    ui:success "Learnings extracted and saved"
  }
}
```

**Integration point in ralph.elv:**
```elvish
if $signals[complete] {
  ui:success "Story "$story-id" completed!"

  # Extract learnings before PR flow
  ui:status "Extracting learnings..."
  claude:extract-learnings $story-id

  # Then continue to PR flow
  var pr-result = (pr:run-flow ...)
}
```

**Output location:** Appends to existing files in `docs/learnings/` based on category:
- `gotchas.md` - Project-specific pitfalls
- `patterns.md` - Reusable patterns discovered
- `conventions.md` - Coding standards learned

**Files:**
- `scripts/ralph/lib/claude.elv`
- `scripts/ralph/ralph.elv`

**Effort:** 1.5 hours

---

### 6. Skip Story Command

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

### 7. Desktop Notifications

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

### 8. Plan Mode

**Problem:** No way to preview what Claude would do without making changes.

**Solution:** Add `--plan` flag that shows plan without executing.

**Implementation:**
```bash
./ralph.elv --plan
```

- Runs Claude with modified prompt asking for plan only
- No git commits, no PRs, no file changes
- Outputs: files to modify, approach, estimated scope
- User can review plan before running `./ralph.elv` to execute

**Prompt addition:**
```markdown
PLAN MODE: Do not make any changes.
Instead, output a detailed plan:
1. Files you would create/modify
2. Approach you would take
3. Key implementation steps
4. Potential risks or blockers

After reviewing, user will run without --plan to execute.
```

**Files:**
- `scripts/ralph/lib/cli.elv`
- `scripts/ralph/lib/claude.elv`
- `scripts/ralph/prompt.md`

**Effort:** 1 hour

---

### 9. Auto-archive Activity Logs

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

### 10. Status/Dependency Visualization

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

### Phase 1: Core Intelligence (Now)
1. PR comment-based feedback system (2 hr)
   - Post feedback as PR comments
   - Post resolution comments
   - Add pr_url to state.json
   - Skip PR prompt when PR exists
   - Update description only at merge
2. Automatic learning extraction (1.5 hr)
   - Runs after every story completion
   - Analyzes activity + diff for patterns
   - Appends to docs/learnings/*.md
3. Editor-based feedback input (15 min)

### Phase 2: Polish (This Week)
4. Desktop notifications (15 min)
5. Status command (1.5 hr)
6. Skip story command (30 min)

### Phase 3: Robustness (Next Week)
7. Pre-flight checks (30 min)
8. Auto-archive logs (20 min)
9. Retry clean slate (20 min)
10. Configurable timeouts (10 min)

### Phase 4: More Intelligence (Following Week)
11. Claude commit messages (1 hr)
12. Plan mode `--plan` (1 hr)

### Phase 5: Observability (Later)
13. Token tracking (2 hr)
14. Verbose mode (20 min)

---

## Open Questions

1. **Story validation:** Should Claude pre-validate that acceptance criteria are clear before starting? Could catch ambiguous stories early. (Optional nice-to-have)

---

## Success Metrics

After implementing improvements, measure:
- Average story completion time
- Feedback loop iterations per story
- Stories blocked rate
- Token usage per story
- User intervention frequency

---

## v2 (Future)

### Webhook/Slack Notifications

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
