# Claude invocation for Ralph

use str
use path
use re
use ./ui
use ./prd
use ./learnings

# Configuration (set by init)
var project-root = ""
var script-dir = ""
var prompt-template = ""
var feedback-template = ""
var workflow-partial = ""
var claude-timeout = 1800
var quiet-mode = $false
var max-iterations = 100
var auto-duplicate = $false
var auto-reverse-deps = $false

# Initialize with configuration
fn init {|root sdir template timeout quiet max-iter &auto-dup=$false &auto-rev-deps=$false|
  set project-root = $root
  set script-dir = $sdir
  set prompt-template = $template
  set claude-timeout = $timeout
  set quiet-mode = $quiet
  set max-iterations = $max-iter
  set auto-duplicate = $auto-dup
  set auto-reverse-deps = $auto-rev-deps

  # Load feedback template and workflow partial (relative to script directory)
  var prompts-dir = (path:join $sdir "prompts")
  try {
    set feedback-template = (cat (path:join $prompts-dir "feedback.md") | slurp)
  } catch _ {
    set feedback-template = ""
  }
  try {
    set workflow-partial = (cat (path:join $prompts-dir "partials" "workflow.md") | slurp)
  } catch _ {
    set workflow-partial = ""
  }
}

# Pre-flight checks before starting
# Returns true if all checks pass, false otherwise
fn preflight-checks {
  var all-ok = $true

  ui:status "Running pre-flight checks..."

  # Check clean git state
  var git-status = ""
  try {
    set git-status = (git -C $project-root status --porcelain 2>/dev/null | slurp)
  } catch _ { }

  if (not (eq (str:trim-space $git-status) "")) {
    ui:warn "  Git: uncommitted changes detected"
    set all-ok = $false
  } else {
    ui:dim "  Git: clean ✓"
  }

  # Check GitHub auth
  try {
    gh auth status 2>&1 | slurp > /dev/null
    ui:dim "  GitHub auth: valid ✓"
  } catch _ {
    ui:warn "  GitHub auth: not authenticated (run 'gh auth login')"
    set all-ok = $false
  }

  # Check required tools
  for cmd [claude jq git gh] {
    if (not (has-external $cmd)) {
      ui:warn "  Tool missing: "$cmd
      set all-ok = $false
    }
  }
  ui:dim "  Tools: claude, jq, git, gh ✓"

  # Check base branch is up to date (optional, just warn)
  try {
    git -C $project-root fetch origin 2>/dev/null
    var local = (git -C $project-root rev-parse dev 2>/dev/null | slurp | str:trim-space)
    var remote = (git -C $project-root rev-parse origin/dev 2>/dev/null | slurp | str:trim-space)
    if (not (eq $local $remote)) {
      ui:warn "  Base branch: out of sync with origin (consider 'git pull')"
    } else {
      ui:dim "  Base branch: up to date ✓"
    }
  } catch _ {
    ui:dim "  Base branch: could not check (offline?)"
  }

  echo ""
  put $all-ok
}

# Archive old activity logs (>7 days) on startup
fn archive-old-logs {
  var activity-dir = (path:join $project-root "logs" "activity" "trinity")
  var archive-dir = (path:join $activity-dir "archive")

  if (not (path:is-dir $activity-dir)) {
    return
  }

  # Get cutoff date (7 days ago)
  var cutoff = ""
  try {
    # macOS date
    set cutoff = (date -v-7d '+%Y-%m-%d' 2>/dev/null)
  } catch _ {
    try {
      # Linux date
      set cutoff = (date -d '7 days ago' '+%Y-%m-%d' 2>/dev/null)
    } catch _ {
      return
    }
  }

  var archived-count = 0
  try {
    for f [(ls $activity-dir)] {
      # Match YYYY-MM-DD.md files
      if (re:match '^\d{4}-\d{2}-\d{2}\.md$' $f) {
        var file-date = (str:trim-suffix ".md" $f)
        # Compare dates lexicographically (works for YYYY-MM-DD format)
        if (< $file-date $cutoff) {
          # Extract year-month for archive folder
          var year-month = $file-date[0..7]
          var target-dir = (path:join $archive-dir $year-month)
          mkdir -p $target-dir
          mv (path:join $activity-dir $f) (path:join $target-dir $f)
          set archived-count = (+ $archived-count 1)
        }
      }
    }
  } catch _ { }

  if (> $archived-count 0) {
    ui:dim "Archived "$archived-count" old activity log(s)"
  }
}

# Get recent activity logs (up to 2 most recent)
fn get-recent-activity-logs {
  var activity-dir = (path:join $project-root "logs" "activity" "trinity")

  # Check if directory exists
  if (not (path:is-dir $activity-dir)) {
    echo "No activity logs found."
    return
  }

  # Find all YYYY-MM-DD.md files, sort by name (date), take last 2
  var log-files = []
  try {
    for f [(ls $activity-dir)] {
      if (and (re:match '^\d{4}-\d{2}-\d{2}\.md$' $f) (not (eq $f "README.md"))) {
        set log-files = [$@log-files $f]
      }
    }
  } catch _ { }

  if (eq (count $log-files) 0) {
    echo "No activity logs found."
    return
  }

  # Sort files (alphabetically = chronologically for YYYY-MM-DD format)
  var sorted-files = [(put $@log-files | order)]

  # Take up to last 2 files (most recent)
  var num-files = (count $sorted-files)
  var start-idx = (if (> $num-files 2) { put (- $num-files 2) } else { put 0 })
  var recent-files = $sorted-files[$start-idx..]

  # Read and output each file with header
  for f $recent-files {
    var full-path = (path:join $activity-dir $f)
    echo "=== Activity Log: "$f" ==="
    echo ""
    cat $full-path
    echo ""
    echo "---"
    echo ""
  }
}

# Prepare prompt and return paths needed for streaming
# Returns: [&prompt-file=<path> &output-file=<path> &story-title=<title>]
# Optional &clarification param for validation clarifications
# Optional &external_deps_report param for external dependency implementation details
fn prepare {|story-id branch-name attempt iteration feedback &clarification="" &external_deps_report=""|
  var prompt = ""

  # If feedback is provided and we have a feedback template, use it
  # Otherwise fall back to injecting feedback into the main template
  if (and (not (eq $feedback "")) (not (eq $feedback-template ""))) {
    # Use dedicated feedback template
    set prompt = $feedback-template

    # Get original task summary (story title + acceptance)
    var original-task = ""
    try {
      var prd-file = (prd:get-prd-file)
      var title = (jq -r '.stories[] | select(.id == "'$story-id'") | .title // ""' $prd-file 2>/dev/null | slurp | str:trim-space)
      var acceptance = (jq -r '.stories[] | select(.id == "'$story-id'") | .acceptance | join("\n- ") // ""' $prd-file 2>/dev/null | slurp | str:trim-space)
      if (not (eq $acceptance "")) {
        set acceptance = "- "$acceptance
      }
      set original-task = "**"$story-id"**: "$title"

**Acceptance Criteria:**
"$acceptance
    } catch _ {
      set original-task = "Story "$story-id
    }

    set prompt = (str:replace &max=-1 "{{ORIGINAL_TASK}}" $original-task $prompt)
    set prompt = (str:replace &max=-1 "{{FEEDBACK}}" $feedback $prompt)
    set prompt = (str:replace &max=-1 "{{WORKFLOW}}" $workflow-partial $prompt)
  } else {
    # Use main template with optional feedback section
    set prompt = $prompt-template

    var feedback-section = ""
    if (not (eq $feedback "")) {
      set feedback-section = "## User Feedback (Refinement Request)

The user has reviewed your work and requested the following changes:

> "$feedback"

**Instructions:**
1. Read the feedback carefully
2. Make the requested changes
3. Run the full verification (build, test, self-review)
4. Commit and push when done
5. Output the completion signal

Stay focused on the feedback - don't refactor unrelated code.
"
    }
    set prompt = (str:replace &max=-1 "{{FEEDBACK}}" $feedback-section $prompt)
  }

  # Common replacements for both templates
  set prompt = (str:replace &max=-1 "{{ITERATION}}" (to-string $iteration) $prompt)
  set prompt = (str:replace &max=-1 "{{MAX_ITERATIONS}}" (to-string $max-iterations) $prompt)
  set prompt = (str:replace &max=-1 "{{CURRENT_STORY}}" $story-id $prompt)
  set prompt = (str:replace &max=-1 "{{BRANCH}}" $branch-name $prompt)
  set prompt = (str:replace &max=-1 "{{ATTEMPT}}" (to-string $attempt) $prompt)
  set prompt = (str:replace &max=-1 "{{VERSION}}" (prd:get-current-version) $prompt)

  # Add dependency info
  var deps-info = (prd:get-story-deps $story-id | slurp)
  set prompt = (str:replace &max=-1 "{{DEPENDENCIES}}" $deps-info $prompt)

  # Add recent activity logs for context
  var activity-logs = (get-recent-activity-logs | slurp)
  set prompt = (str:replace &max=-1 "{{RECENT_ACTIVITY_LOGS}}" $activity-logs $prompt)

  # Add clarification if provided (from validation questions)
  if (not (eq $clarification "")) {
    var clarification-section = "## User Clarification

The user provided this clarification to resolve ambiguities in the story:

> "$clarification"

Use this to guide your implementation decisions.

"
    # Insert before the Quick Reference section
    set prompt = (str:replace &max=-1 "## Quick Reference" $clarification-section"## Quick Reference" $prompt)
  }

  # Add external dependencies report if provided
  if (not (eq $external_deps_report "")) {
    var ext-deps-section = "## External Dependencies Report

This story has external dependencies that the user has already implemented. Here is their report:

> "$external_deps_report"

Use this information to integrate with the external systems correctly (endpoints, auth, schemas, etc.).

"
    # Insert before the Quick Reference section
    set prompt = (str:replace &max=-1 "## Quick Reference" $ext-deps-section"## Quick Reference" $prompt)
  }

  var output-file = (mktemp)
  var prompt-file = (mktemp)
  echo $prompt > $prompt-file

  # Get story title for display
  var story-title = (prd:get-story-title $story-id)

  put [&prompt-file=$prompt-file &output-file=$output-file &story-title=$story-title]
}

# Get config for streaming (called from main script)
fn get-config {
  put [&project-root=$project-root &timeout=$claude-timeout &quiet-mode=$quiet-mode]
}

# Check output file for completion signals
fn check-signals {|output-file story-id|
  var story-complete = $false
  var story-blocked = $false
  var all-complete = $false

  try {
    grep -q '<story-complete>'$story-id'</story-complete>' $output-file
    set story-complete = $true
  } catch { }

  try {
    grep -q '<story-blocked>'$story-id'</story-blocked>' $output-file
    set story-blocked = $true
  } catch { }

  try {
    grep -q '<promise>COMPLETE</promise>' $output-file
    set all-complete = $true
  } catch { }

  # Return as map (no ui output inside function to avoid value capture issues)
  put [&complete=$story-complete &blocked=$story-blocked &all_complete=$all-complete]
}

# Cleanup output file
fn cleanup {|output-file|
  rm -f $output-file
  ui:dim "  Cleaned up temp file"
}

# Extract learnings from completed story (delegates to learnings module)
fn extract-learnings {|story-id branch-name|
  learnings:extract $story-id $branch-name
}

# Generate plan-only prompt for a story (no file changes)
fn prepare-plan-prompt {|story-id|
  # Get story details
  var prd-file = (prd:get-prd-file)
  var story-json = ""
  try {
    set story-json = (jq -r '.stories[] | select(.id == "'$story-id'")' $prd-file 2>/dev/null | slurp)
  } catch _ { }

  var title = (try { jq -r '.stories[] | select(.id == "'$story-id'") | .title // ""' $prd-file | slurp | str:trim-space } catch _ { put "" })
  var acceptance = (try { jq -r '.stories[] | select(.id == "'$story-id'") | .acceptance | join("\n- ") // ""' $prd-file | slurp | str:trim-space } catch _ { put "" })
  var deps = (prd:get-story-deps $story-id | slurp)

  var version = (prd:get-current-version)
  var prompt = '# Plan Mode - '$version' / '$story-id'

## Context
Version: '$version' | Story: '$story-id'

## Story
**'$story-id'**: '$title'

## Acceptance Criteria
- '$acceptance'

## Dependencies
'$deps'

## Task
Create an implementation plan for this story. Do NOT make any changes to files.

Output a detailed plan that includes:
1. **Files to create/modify** - list each file with what changes are needed
2. **Implementation steps** - ordered list of what to do
3. **Testing approach** - how to verify the implementation
4. **Potential challenges** - gotchas or edge cases to watch for

Read the following for context:
- `tools/ralph/cli/prd/'$version'.json` - full story details
- `docs/ARCHITECTURE.md` - system design
- `docs/learnings/` - existing learnings

Format your response as a clear, actionable plan.

**IMPORTANT: Do NOT create, modify, or delete any files. This is plan-only mode.**'

  # Write to temp file and return path
  var prompt-file = (mktemp)
  echo $prompt > $prompt-file
  put $prompt-file
}

# Generate conventional commit message for a story
# Returns the commit message string
fn generate-commit-message {|story-id branch-name|
  # Get story title
  var story-title = (prd:get-story-title $story-id)

  # Get diff for this story
  var base = "dev"  # TODO: get from config
  var diff = ""
  try {
    set diff = (git -C $project-root diff --stat $base"..."$branch-name 2>/dev/null | slurp)
  } catch _ { }

  if (eq $diff "") {
    # No diff, return simple message
    put "feat: "$story-id" - "$story-title
    return
  }

  # Get files changed summary
  var files-changed = ""
  try {
    set files-changed = (git -C $project-root diff --name-only $base"..."$branch-name 2>/dev/null | slurp)
  } catch _ { }

  var prompt = 'Generate a conventional commit message for this story.

STORY: '$story-id' - '$story-title'

FILES CHANGED:
'$files-changed'

DIFF STATS:
'$diff'

Rules:
- Use conventional commit format: type(scope): description
- Types: feat, fix, refactor, test, docs, chore
- Scope is optional but helpful (e.g., cli, core, ralph)
- Description should be imperative, lowercase, no period
- Keep under 72 characters
- Add bullet points for significant changes (2-4 max)

Output format (exactly):
<commit-message>
type(scope): brief description

- Change 1
- Change 2
</commit-message>'

  var result = ""
  try {
    set result = (echo $prompt | claude --dangerously-skip-permissions --print 2>/dev/null | slurp)
  } catch e {
    # Fallback to simple message
    put "feat: "$story-id" - "$story-title
    return
  }

  # Extract commit message from tags
  if (str:contains $result "<commit-message>") {
    try {
      var msg = (echo $result | sed -n '/<commit-message>/,/<\/commit-message>/p' | sed '1d;$d' | str:trim-space (slurp))
      if (not (eq $msg "")) {
        put $msg
        return
      }
    } catch _ { }
  }

  # Fallback
  put "feat: "$story-id" - "$story-title
}

# Validate story acceptance criteria before execution
# Returns: map with &valid (bool) and &questions (string, empty if valid)
fn validate-story {|story-id|
  ui:status "Validating story acceptance criteria..."

  var prd-file = (prd:get-prd-file)

  # Get title and acceptance using jq with fallback
  var title = ""
  var title-raw = [(jq -r '.stories[] | select(.id == "'$story-id'") | .title // ""' $prd-file 2>/dev/null)]
  if (> (count $title-raw) 0) {
    set title = $title-raw[0]
  }

  var acceptance = ""
  var acc-raw = [(jq -r '.stories[] | select(.id == "'$story-id'") | .acceptance | join("\n- ") // ""' $prd-file 2>/dev/null)]
  if (> (count $acc-raw) 0) {
    set acceptance = $acc-raw[0]
  }

  if (eq $acceptance "") {
    ui:warn "Story "$story-id" has no acceptance criteria, skipping validation"
    put [&valid=$true &questions=""]
    return
  }

  var prompt = 'Review this story. Can it be implemented unambiguously?

STORY: '$story-id' - '$title'

ACCEPTANCE CRITERIA:
- '$acceptance'

Check for:
- Vague terms ("settings", "improve", "better", "handle", "properly")
- Missing specifics (which fields, what UI, what endpoint, what format)
- Unclear scope or boundaries
- Ambiguous success criteria
- Missing error handling requirements

Output ONLY one of:
<valid/> if clear enough to implement unambiguously

OR

<needs-clarification>
- Question 1?
- Question 2?
</needs-clarification>

Be pragmatic - minor ambiguity is OK if the intent is clear. Only flag things that could lead to implementing the wrong thing.'

  var result = ""
  var result-raw = [(echo $prompt | claude --dangerously-skip-permissions --print 2>/dev/null)]
  if (> (count $result-raw) 0) {
    set result = (str:join "\n" $result-raw)
  }

  if (eq $result "") {
    ui:warn "Validation check failed, proceeding anyway"
    put [&valid=$true &questions=""]
    return
  }

  if (str:contains $result "<valid/>") {
    ui:success "Story validation passed"
    put [&valid=$true &questions=""]
    return
  }

  if (str:contains $result "<needs-clarification>") {
    # Extract questions from the response
    var questions = ""
    try {
      set questions = (echo $result | sed -n '/<needs-clarification>/,/<\/needs-clarification>/p' | grep '^\s*-' | slurp)
    } catch _ {
      set questions = $result
    }

    # Display to user
    ui:warn "Story needs clarification:" > /dev/tty
    echo "" > /dev/tty
    echo $questions > /dev/tty
    echo "" > /dev/tty

    put [&valid=$false &questions=$questions]
    return
  }

  # Unexpected response, proceed anyway
  ui:dim "Validation returned unexpected response, proceeding"
  put [&valid=$true &questions=""]
}

# Run plan mode for a story (read-only, no file changes)
fn run-plan-mode {|story-id target-version|
  ui:box "PLAN MODE - Read-Only" "info"
  echo ""

  var story-title = (prd:get-story-title $story-id)
  ui:status "Planning for story: "$story-id
  ui:dim "  Title: "$story-title
  echo ""

  # Generate plan prompt
  var prompt-file = (prepare-plan-prompt $story-id)

  ui:divider "Implementation Plan"
  echo ""

  # Run Claude in print mode (no permissions needed for plan)
  try {
    claude --print < $prompt-file 2>/dev/null
  } catch e {
    ui:error "Plan generation failed: "(to-string $e[reason])
  } finally {
    rm -f $prompt-file
  }

  echo ""
  ui:divider-end
  ui:dim "Plan mode complete. No files were modified."
}

# Check if a proposed story is a duplicate of an existing story
# Returns: [&duplicate=$id-or-nil &similarity=$high-med-low &reason=$string]
fn check-for-duplicate {|title intent tags-json similar-ids|
  if (eq (count $similar-ids) 0) {
    put [&duplicate=$nil &similarity="" &reason=""]
    return
  }

  # Build context about similar stories
  var stories-context = ""
  for sid $similar-ids {
    var s-title = (prd:get-story-title $sid)
    var s-info = (jq -r '.stories[] | select(.id == "'$sid'") | "\(.acceptance | join("; "))\t\(.tags | join(", "))"' (prd:get-prd-file))
    var parts = [(str:split "\t" $s-info)]
    var s-acceptance = $parts[0]
    var s-tags = $parts[1]
    set stories-context = $stories-context"- "$sid": \""$s-title"\" ["$s-tags"]\n  Acceptance: "$s-acceptance"\n\n"
  }

  var prompt = 'Check if this proposed new story duplicates an existing one.

## Proposed Story
Title: "'$title'"
Intent: "'$intent'"
Tags: '$tags-json'

## Existing Stories (share ≥1 tag)
'$stories-context'

## Task
Determine if the proposed story is a duplicate (covers same functionality) of any existing story.
Use 60% semantic similarity as threshold.

Output JSON only:
- If duplicate: {"duplicate": "X.Y.Z", "similarity": "high", "reason": "Both handle token expiry..."}
- If no duplicate: {"duplicate": null, "similarity": "none", "reason": "Proposed story covers different functionality"}
'

  var result = ""
  try {
    set result = (echo $prompt | claude --dangerously-skip-permissions --print 2>/dev/null | slurp)
  } catch e {
    # On error, assume no duplicate
    put [&duplicate=$nil &similarity="" &reason="Error checking"]
    return
  }

  # Extract JSON from response
  var json-result = ""
  try {
    # Try to find JSON in response
    set json-result = (echo $result | grep -o '{[^}]*}' | head -1)
  } catch _ {
    put [&duplicate=$nil &similarity="" &reason="Could not parse response"]
    return
  }

  var dup-id = ""
  var dup-sim = ""
  var dup-reason = ""
  try {
    set dup-id = (echo $json-result | jq -r '.duplicate // ""')
    set dup-sim = (echo $json-result | jq -r '.similarity // ""')
    set dup-reason = (echo $json-result | jq -r '.reason // ""')
  } catch _ { }

  if (or (eq $dup-id "") (eq $dup-id "null")) {
    put [&duplicate=$nil &similarity=$dup-sim &reason=$dup-reason]
  } else {
    put [&duplicate=$dup-id &similarity=$dup-sim &reason=$dup-reason]
  }
}

# Prompt user for duplicate resolution
# Returns: "update", "create", or "skip"
fn prompt-duplicate-choice {|proposed-title dup-id dup-reason|
  var dup-title = (prd:get-story-title $dup-id)
  var dup-tags = (jq -r '.stories[] | select(.id == "'$dup-id'") | .tags | join(", ")' (prd:get-prd-file))

  echo "" > /dev/tty
  ui:warn "Potential duplicate found:" > /dev/tty
  echo "  Existing: "$dup-id": "$dup-title" ["$dup-tags"]" > /dev/tty
  echo "  Proposed: "$proposed-title > /dev/tty
  echo "  Reason:   "$dup-reason > /dev/tty
  echo "" > /dev/tty
  echo "\e[33m[u]pdate existing / [c]reate new anyway / [s]kip\e[0m" > /dev/tty

  var answer = ""
  try {
    set answer = (bash -c 'read -n 1 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null)
  } catch _ { }
  echo "" > /dev/tty

  if (re:match '^[uU]' $answer) {
    put "update"
  } elif (re:match '^[cC]' $answer) {
    put "create"
  } else {
    put "skip"
  }
}

# Check for reverse dependencies - existing stories that should depend on a new story
# Returns list of suggestions: [{id, should_depend, reason}, ...]
fn check-reverse-deps {|new-id new-title new-intent new-tags-json|
  # Find stories with overlapping tags
  var similar-ids = [(prd:find-similar-by-tags $new-tags-json &min-overlap=(num 1))]

  if (eq (count $similar-ids) 0) {
    put []
    return
  }

  # Get new story's phase for backwards dep check
  var new-phase = (num (prd:get-story-phase $new-id))

  # Filter candidates
  var candidates = []
  var own-deps = [(prd:get-story-deps $new-id)]
  var already-dependents = [(prd:get-dependents $new-id)]

  for sid $similar-ids {
    # Skip self
    if (eq $sid $new-id) { continue }

    # Skip stories that new story depends on (avoid cycles)
    if (has-value $own-deps $sid) { continue }

    # Skip stories that already depend on new story
    if (has-value $already-dependents $sid) { continue }

    # Skip if would create cycle
    if (prd:would-create-cycle $sid $new-id) { continue }

    # Skip stories in earlier phases (backwards dependency - rejected per plan)
    var sid-phase = (num (prd:get-story-phase $sid))
    if (< $sid-phase $new-phase) { continue }

    set candidates = [$@candidates $sid]
  }

  if (eq (count $candidates) 0) {
    put []
    return
  }

  # Build context about candidate stories
  var stories-context = ""
  for sid $candidates {
    var s-title = (prd:get-story-title $sid)
    var s-deps = (jq -r '.stories[] | select(.id == "'$sid'") | .depends_on // [] | join(", ")' (prd:get-prd-file))
    var s-acceptance = (jq -r '.stories[] | select(.id == "'$sid'") | .acceptance // [] | join("; ")' (prd:get-prd-file))
    var s-tags = (jq -r '.stories[] | select(.id == "'$sid'") | .tags // [] | join(", ")' (prd:get-prd-file))
    set stories-context = $stories-context"- "$sid": \""$s-title"\" ["$s-tags"]\n  Current deps: ["$s-deps"]\n  Acceptance: "$s-acceptance"\n\n"
  }

  var prompt = 'Analyze if existing stories should depend on a newly created story.

## New Story Created
ID: '$new-id'
Title: "'$new-title'"
Intent: "'$new-intent'"
Tags: '$new-tags-json'

## Candidate Stories (share tags, might need to depend on new story)
'$stories-context'

## Task
For each candidate, determine if it LOGICALLY needs '$new-id' to function correctly.
A story should depend on '$new-id' if it uses functionality that '$new-id' provides.

Output JSON only:
{
  "suggestions": [
    {"id": "X.Y.Z", "should_depend": true, "reason": "Uses token refresh logic"},
    {"id": "A.B.C", "should_depend": false, "reason": "Unrelated functionality"}
  ]
}
'

  var result = ""
  try {
    set result = (echo $prompt | claude --dangerously-skip-permissions --print 2>/dev/null | slurp)
  } catch e {
    put []
    return
  }

  # Extract JSON from response
  var json-result = ""
  try {
    set json-result = (echo $result | sed -n '/```json/,/```/p' | sed '1d;$d' | slurp)
    if (eq $json-result "") {
      set json-result = (echo $result | grep -o '{[^{}]*"suggestions"[^{}]*\[.*\][^{}]*}' | head -1)
    }
  } catch _ {
    put []
    return
  }

  # Parse suggestions
  var suggestions = []
  try {
    set suggestions = [(echo $json-result | jq -c '.suggestions[]?' | each {|s|
      var id = (echo $s | jq -r '.id')
      var should = (echo $s | jq -r '.should_depend')
      var reason = (echo $s | jq -r '.reason')
      if (eq $should "true") {
        put [&id=$id &should_depend=$true &reason=$reason]
      }
    })]
  } catch _ { }

  put $suggestions
}

# Prompt user for reverse dependency suggestions
# Returns: "all", "none", or "review"
fn prompt-reverse-deps {|new-id suggestions|
  echo "" > /dev/tty
  ui:status "Suggested reverse dependencies for "$new-id":" > /dev/tty

  for s $suggestions {
    var s-title = (prd:get-story-title $s[id])
    echo "  • "$s[id]": "$s-title > /dev/tty
    echo "    → "$s[reason] > /dev/tty
  }

  echo "" > /dev/tty
  echo "\e[33m[y]es add all / [n]o skip all / [r]eview individually\e[0m" > /dev/tty

  var answer = ""
  try {
    set answer = (bash -c 'read -n 1 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null)
  } catch _ { }
  echo "" > /dev/tty

  if (re:match '^[yY]' $answer) {
    put "all"
  } elif (re:match '^[rR]' $answer) {
    put "review"
  } else {
    put "none"
  }
}

# Review each reverse dep suggestion individually
# Returns list of IDs to add
fn review-reverse-deps-individually {|new-id suggestions|
  var to-add = []

  for s $suggestions {
    var s-title = (prd:get-story-title $s[id])
    echo "" > /dev/tty
    echo "Add "$new-id" as dependency to "$s[id]"?" > /dev/tty
    echo "  "$s[id]": "$s-title > /dev/tty
    echo "  Reason: "$s[reason] > /dev/tty
    echo "\e[33m[y]es / [n]o\e[0m" > /dev/tty

    var answer = ""
    try {
      set answer = (bash -c 'read -n 1 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null)
    } catch _ { }
    echo "" > /dev/tty

    if (re:match '^[yY]' $answer) {
      set to-add = [$@to-add $s[id]]
    }
  }

  put $to-add
}

# Apply reverse dependency suggestions
fn apply-reverse-deps {|new-id story-ids|
  for sid $story-ids {
    # Double-check no cycle before adding
    if (not (prd:would-create-cycle $sid $new-id)) {
      prd:add-dependency $sid $new-id
      ui:success "  ✓ "$sid" now depends on "$new-id > /dev/tty
    } else {
      ui:warn "  ✗ Skipped "$sid" (would create cycle)" > /dev/tty
    }
  }
}

# Propagate external deps report to descendant stories
# Analyzes descendants, identifies gaps, creates new stories, with user confirmation
fn propagate-external-deps {|story-id report|
  ui:status "Analyzing PRD for updates and gaps..."

  # Get all descendants
  var descendants = [(prd:get-descendants $story-id)]
  var summary = ""
  if (> (count $descendants) 0) {
    ui:dim "  Found "(count $descendants)" descendant(s): "(str:join ", " $descendants)
    set summary = (prd:get-stories-summary $descendants)
  } else {
    ui:dim "  No dependent stories found"
    set summary = "(No existing dependent stories)"
  }

  var story-title = (prd:get-story-title $story-id)
  var story-info = (prd:get-story-info $story-id)
  var info-parts = [(str:split "\t" $story-info)]
  var phase = $info-parts[0]
  var epic = $info-parts[1]

  var prompt = 'You are refining a PRD based on implementation decisions.

Story '$story-id' ("'$story-title'") in Phase '$phase', Epic '$epic' has external dependencies that were just implemented.

## External Dependencies Report
'$report'

## Existing Descendant Stories
These stories depend on '$story-id' (directly or transitively):

'$summary'

## Available Tags
Domain: core, cli, db, git, claude, prompts, auth
Feature: config, prd, loop, validation, recovery, release, skills
Concern: api, testing, ux, docs

## Task
1. Analyze existing descendants: which need acceptance criteria or tag updates?
2. Identify GAPS: what new stories are needed based on the report?
3. Check for DUPLICATES: before creating, verify no similar story exists (same tags + similar intent)
4. For new stories, determine proper phase/epic placement, dependencies, and tags

Output format (JSON):
```json
{
  "updates": [
    {
      "id": "X.Y.Z",
      "reason": "Why this needs updating",
      "acceptance": ["Updated criterion 1", "Updated criterion 2"],
      "tags": ["auth", "api"]
    }
  ],
  "create": [
    {
      "title": "Story title",
      "intent": "Why this story is needed",
      "acceptance": ["Criterion 1", "Criterion 2"],
      "tags": ["auth", "api"],
      "phase": '$phase',
      "epic": '$epic',
      "depends_on": ["'$story-id'"],
      "reason": "Why this new story is needed"
    }
  ],
  "skip": [
    {
      "id": "X.Y.Z",
      "reason": "Why this can stay as-is"
    }
  ]
}
```

Rules:
- Only update stories where the report is directly relevant
- Include tags in updates if they should change (omit if unchanged)
- Create new stories for functionality revealed by the report but not covered
- Before creating, check existing stories with similar tags - update instead of duplicate
- New stories should have proper dependencies (on '$story-id' or other stories)
- Assign appropriate tags from the taxonomy above
- Keep acceptance criteria specific, testable, referencing concrete details
- Use same phase/epic as '$story-id' unless clearly belongs elsewhere
- Preserve valid existing criteria when updating'

  var result = ""
  try {
    set result = (echo $prompt | claude --dangerously-skip-permissions --print 2>/dev/null | slurp)
  } catch e {
    ui:error "Failed to analyze PRD: "(to-string $e[reason])
    return
  }

  # Extract JSON from response
  var json-block = ""
  try {
    set json-block = (echo $result | sed -n '/```json/,/```/p' | sed '1d;$d' | slurp)
  } catch _ {
    ui:warn "Could not parse Claude response"
    return
  }

  if (eq $json-block "") {
    ui:dim "  No changes needed"
    return
  }

  # Parse results
  var updates = []
  var creates = []
  var skips = []
  try {
    set updates = [(echo $json-block | jq -r '.updates[]? | "\(.id)|\(.reason)"')]
  } catch _ { }
  try {
    set creates = [(echo $json-block | jq -r '.create[]? | "\(.title)|\(.reason)"')]
  } catch _ { }
  try {
    set skips = [(echo $json-block | jq -r '.skip[]? | "\(.id): \(.reason)"')]
  } catch _ { }

  # Show summary
  echo "" > /dev/tty
  ui:divider "PRD Changes Summary" > /dev/tty

  if (> (count $updates) 0) {
    echo "" > /dev/tty
    ui:status "Updates ("(count $updates)"):" > /dev/tty
    for update $updates {
      var parts = [(str:split "|" $update)]
      ui:dim "  • "$parts[0]": "$parts[1] > /dev/tty
    }
  }

  if (> (count $creates) 0) {
    echo "" > /dev/tty
    ui:status "New stories ("(count $creates)"):" > /dev/tty
    for create $creates {
      var parts = [(str:split "|" $create)]
      ui:dim "  • "$parts[0] > /dev/tty
      if (> (count $parts) 1) {
        ui:dim "    Reason: "$parts[1] > /dev/tty
      }
    }
  }

  if (> (count $skips) 0) {
    echo "" > /dev/tty
    ui:dim "Unchanged ("(count $skips)"):" > /dev/tty
    for skip $skips {
      ui:dim "  • "$skip > /dev/tty
    }
  }

  # Check if any changes
  if (and (eq (count $updates) 0) (eq (count $creates) 0)) {
    echo "" > /dev/tty
    ui:dim "No changes to make" > /dev/tty
    ui:divider-end > /dev/tty
    return
  }

  # User confirmation
  echo "" > /dev/tty
  ui:divider-end > /dev/tty
  echo "\e[33m[y]es save / [n]o discard / [e]dit in editor\e[0m" > /dev/tty
  var answer = ""
  try {
    set answer = (bash -c 'read -n 1 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null)
  } catch _ { }
  echo "" > /dev/tty

  if (re:match '^[nN]' $answer) {
    ui:dim "Changes discarded" > /dev/tty
    return
  }

  if (re:match '^[eE]' $answer) {
    # Open JSON in editor for manual adjustments
    var tmp = (mktemp --suffix=.json)
    echo $json-block | jq '.' > $tmp

    var editor = "vim"
    if (has-env EDITOR) { set editor = $E:EDITOR }

    ui:status "Opening editor for adjustments..." > /dev/tty
    try {
      (external $editor) $tmp </dev/tty >/dev/tty 2>/dev/tty
    } catch _ { }

    set json-block = (cat $tmp | slurp)
    rm -f $tmp

    # Re-parse after edit
    set updates = []
    set creates = []
    try {
      set updates = [(echo $json-block | jq -r '.updates[]? | "\(.id)|\(.reason)"')]
    } catch _ { }
    try {
      set creates = [(echo $json-block | jq -r '.create[]? | "\(.title)|\(.reason)"')]
    } catch _ { }
  }

  # Apply updates
  if (> (count $updates) 0) {
    ui:status "Applying updates..." > /dev/tty
    for update $updates {
      var parts = [(str:split "|" $update)]
      var sid = $parts[0]
      var reason = $parts[1]

      # Get update fields
      var update-obj = ""
      try {
        set update-obj = (echo $json-block | jq -c '.updates[] | select(.id == "'$sid'")')
      } catch _ { continue }

      # Build fields to update
      var fields = [&]
      var new-acceptance = (echo $update-obj | jq -c '.acceptance // null')
      var new-tags = (echo $update-obj | jq -c '.tags // null')

      if (and (not (eq $new-acceptance "null")) (not (eq $new-acceptance ""))) {
        set fields[acceptance] = $new-acceptance
      }
      if (and (not (eq $new-tags "null")) (not (eq $new-tags ""))) {
        set fields[tags] = $new-tags
      }

      if (> (count $fields) 0) {
        # Convert fields map to JSON
        var fields-json = (put $fields | to-json)
        prd:update-story $sid $fields-json
        ui:success "  ✓ Updated "$sid > /dev/tty
      }
    }
  }

  # Create new stories
  if (> (count $creates) 0) {
    ui:status "Creating new stories..." > /dev/tty

    var create-items = [(echo $json-block | jq -c '.create[]?')]
    for item $create-items {
      var title = (echo $item | jq -r '.title')
      var intent = (echo $item | jq -r '.intent // ""')
      var cr-phase = (echo $item | jq -r '.phase')
      var cr-epic = (echo $item | jq -r '.epic')
      var cr-depends = (echo $item | jq -c '.depends_on // []')
      var cr-tags = (echo $item | jq -c '.tags // []')

      # Check for duplicates before creating
      var similar-ids = [(prd:find-similar-by-tags $cr-tags &min-overlap=(num 1))]
      if (> (count $similar-ids) 0) {
        var dup-check = (check-for-duplicate $title $intent $cr-tags $similar-ids)

        if (not (eq $dup-check[duplicate] $nil)) {
          var action = ""
          if $auto-duplicate {
            # Auto mode: update existing
            set action = "update"
            ui:dim "  Auto-updating existing "$dup-check[duplicate]" instead of creating new" > /dev/tty
          } else {
            # Prompt user
            set action = (prompt-duplicate-choice $title $dup-check[duplicate] $dup-check[reason])
          }

          if (eq $action "update") {
            # Update existing story instead of creating
            var existing-acceptance = (echo $item | jq -c '.acceptance // []')
            var existing-tags = $cr-tags
            var fields-json = (put [&acceptance=$existing-acceptance &tags=$existing-tags] | to-json)
            prd:update-story $dup-check[duplicate] $fields-json
            ui:success "  ✓ Updated existing "$dup-check[duplicate] > /dev/tty
            continue
          } elif (eq $action "skip") {
            ui:dim "  ○ Skipped: "$title > /dev/tty
            continue
          }
          # action == "create" falls through to create below
        }
      }

      # Get next story number
      var story-num = (prd:get-next-story-number $cr-phase $cr-epic)
      var new-id = $cr-phase"."$cr-epic"."$story-num

      # Validate dependencies
      var dep-list = [(echo $cr-depends | jq -r '.[]?')]
      var validation = (prd:validate-dependencies $new-id $dep-list)
      if (not $validation[valid]) {
        ui:warn "  ✗ Skipping "$title": "(str:join ", " $validation[errors]) > /dev/tty
        continue
      }

      # Build full story JSON (ensure tags defaults to empty array)
      var new-story = (echo $item | jq -c '. + {
        "id": "'$new-id'",
        "story_number": '$story-num',
        "target_version": "'(prd:get-current-version)'",
        "passes": false,
        "merged": false,
        "tags": (.tags // [])
      }')

      prd:create-story $new-story
      ui:success "  ✓ Created "$new-id": "$title > /dev/tty

      # Check for reverse dependencies
      var rev-suggestions = (check-reverse-deps $new-id $title $intent $cr-tags)
      if (> (count $rev-suggestions) 0) {
        if $auto-reverse-deps {
          # Auto mode: add all suggested deps
          ui:dim "  Auto-adding reverse dependencies..." > /dev/tty
          var all-ids = [(each {|s| put $s[id]} $rev-suggestions)]
          apply-reverse-deps $new-id $all-ids
        } else {
          # Prompt user
          var choice = (prompt-reverse-deps $new-id $rev-suggestions)
          if (eq $choice "all") {
            var all-ids = [(each {|s| put $s[id]} $rev-suggestions)]
            apply-reverse-deps $new-id $all-ids
          } elif (eq $choice "review") {
            var to-add = (review-reverse-deps-individually $new-id $rev-suggestions)
            if (> (count $to-add) 0) {
              apply-reverse-deps $new-id $to-add
            }
          } else {
            ui:dim "  Skipped reverse dependencies" > /dev/tty
          }
        }
      }
    }
  }

  echo "" > /dev/tty
  ui:success "PRD updated successfully" > /dev/tty
}
