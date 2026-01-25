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

# Initialize with configuration
fn init {|root sdir template timeout quiet max-iter|
  set project-root = $root
  set script-dir = $sdir
  set prompt-template = $template
  set claude-timeout = $timeout
  set quiet-mode = $quiet
  set max-iterations = $max-iter

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

# Propagate external deps report to descendant stories
# Analyzes which descendants need updating and updates their acceptance criteria
fn propagate-external-deps {|story-id report|
  ui:status "Analyzing descendant stories for updates..."

  # Get all descendants
  var descendants = [(prd:get-descendants $story-id)]

  if (eq (count $descendants) 0) {
    ui:dim "  No dependent stories found"
    return
  }

  ui:dim "  Found "(count $descendants)" descendant(s): "(str:join ", " $descendants)

  # Get summary of descendants for Claude
  var summary = (prd:get-stories-summary $descendants)
  var story-title = (prd:get-story-title $story-id)

  var prompt = 'You are updating a PRD based on implementation decisions.

Story '$story-id' ("'$story-title'") has external dependencies that were just implemented.

## External Dependencies Report
'$report'

## Descendant Stories
These stories depend on '$story-id' (directly or transitively):

'$summary'

## Task
Analyze each descendant story. Determine which ones need their acceptance criteria updated based on the external deps report.

For stories that need updates, provide specific, concrete acceptance criteria that reference the actual implementation details from the report.

Output format (JSON):
```json
{
  "updates": [
    {
      "id": "X.Y.Z",
      "reason": "Brief reason why this needs updating",
      "acceptance": ["New criterion 1", "New criterion 2", "..."]
    }
  ],
  "skip": [
    {
      "id": "X.Y.Z",
      "reason": "Brief reason why this can stay as-is"
    }
  ]
}
```

Rules:
- Only update stories where the external deps report is directly relevant
- Keep acceptance criteria specific and testable
- Preserve any existing criteria that are still valid
- Reference concrete details from the report (endpoints, formats, etc.)
- Skip stories that are unrelated to the external dependencies'

  var result = ""
  try {
    set result = (echo $prompt | claude --dangerously-skip-permissions --print 2>/dev/null | slurp)
  } catch e {
    ui:error "Failed to analyze descendants: "(to-string $e[reason])
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
    ui:dim "  No updates needed"
    return
  }

  # Parse and apply updates
  var updates = []
  try {
    set updates = [(echo $json-block | jq -r '.updates[]? | "\(.id)|\(.reason)"')]
  } catch _ { }

  var skips = []
  try {
    set skips = [(echo $json-block | jq -r '.skip[]? | "\(.id): \(.reason)"')]
  } catch _ { }

  # Show skips
  if (> (count $skips) 0) {
    ui:dim "  Skipping (unrelated):"
    for skip $skips {
      ui:dim "    - "$skip
    }
  }

  # Apply updates
  if (> (count $updates) 0) {
    ui:status "Updating "(count $updates)" descendant(s):"
    for update $updates {
      var parts = [(str:split "|" $update)]
      var sid = $parts[0]
      var reason = ""
      if (> (count $parts) 1) {
        set reason = $parts[1]
      }

      # Get new acceptance criteria for this story
      var new-acceptance = ""
      try {
        set new-acceptance = (echo $json-block | jq -c '.updates[] | select(.id == "'$sid'") | .acceptance')
      } catch _ {
        continue
      }

      if (and (not (eq $new-acceptance "")) (not (eq $new-acceptance "null"))) {
        prd:update-story-acceptance $sid $new-acceptance
        ui:success "  ✓ "$sid": "$reason
      }
    }
  } else {
    ui:dim "  No stories need updating"
  }
}
