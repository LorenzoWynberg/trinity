# Claude invocation for Ralph

use str
use path
use re
use ./ui
use ./prd

# Configuration (set by init)
var project-root = ""
var prompt-template = ""
var claude-timeout = 1800
var quiet-mode = $false
var max-iterations = 100

# Initialize with configuration
fn init {|root template timeout quiet max-iter|
  set project-root = $root
  set prompt-template = $template
  set claude-timeout = $timeout
  set quiet-mode = $quiet
  set max-iterations = $max-iter
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
  var activity-dir = (path:join $project-root "docs" "activity")
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
  var activity-dir = (path:join $project-root "docs" "activity")

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
fn prepare {|story-id branch-name attempt iteration feedback|
  # Build feedback section if provided
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

  # Build prompt from template
  var prompt = (str:replace &max=-1 "{{ITERATION}}" (to-string $iteration) $prompt-template)
  set prompt = (str:replace &max=-1 "{{MAX_ITERATIONS}}" (to-string $max-iterations) $prompt)
  set prompt = (str:replace &max=-1 "{{CURRENT_STORY}}" $story-id $prompt)
  set prompt = (str:replace &max=-1 "{{BRANCH}}" $branch-name $prompt)
  set prompt = (str:replace &max=-1 "{{ATTEMPT}}" (to-string $attempt) $prompt)
  set prompt = (str:replace &max=-1 "{{FEEDBACK}}" $feedback-section $prompt)
  set prompt = (str:replace &max=-1 "{{VERSION}}" (prd:get-current-version) $prompt)

  # Add dependency info
  var deps-info = (prd:get-story-deps $story-id | slurp)
  set prompt = (str:replace &max=-1 "{{DEPENDENCIES}}" $deps-info $prompt)

  # Add recent activity logs for context
  var activity-logs = (get-recent-activity-logs | slurp)
  set prompt = (str:replace &max=-1 "{{RECENT_ACTIVITY_LOGS}}" $activity-logs $prompt)

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

# Extract learnings from completed story
# Analyzes what was done and appends to docs/learnings/
fn extract-learnings {|story-id branch-name|
  ui:status "Extracting learnings from story..."

  # Get story activity (from today's log)
  var activity = ""
  var today = (date '+%Y-%m-%d')
  var activity-file = (path:join $project-root "docs" "activity" $today".md")
  if (path:is-regular $activity-file) {
    try {
      set activity = (cat $activity-file | slurp)
    } catch _ { }
  }

  # Get diff for this story
  var diff = ""
  try {
    var base = "dev"  # TODO: get from config
    set diff = (git -C $project-root diff $base"..."$branch-name 2>/dev/null | slurp)
  } catch _ { }

  if (eq $diff "") {
    ui:dim "  No diff found, skipping learning extraction"
    return
  }

  # Get existing learnings for context (to avoid duplicates)
  var existing = ""
  var learnings-dir = (path:join $project-root "docs" "learnings")
  if (path:is-dir $learnings-dir) {
    try {
      set existing = (cat $learnings-dir"/"*.md 2>/dev/null | slurp)
    } catch _ { }
  }

  var prompt = 'Analyze this completed story and extract learnings.

STORY: '$story-id'

ACTIVITY LOG:
'$activity'

CHANGES MADE (DIFF):
'$diff'

EXISTING LEARNINGS (do not duplicate these):
'$existing'

Look for:
- Gotchas or surprises encountered
- Patterns that would help future stories
- Project-specific conventions discovered
- Mistakes made and then corrected
- Non-obvious implementation details

Output format - choose ONE:

If nothing notable to learn:
<no-learnings/>

OR if there are learnings:
<learning file="gotchas.md">
## Title of Learning

Content to append...
</learning>

<learning file="patterns.md">
## Another Learning

More content...
</learning>

Valid files: gotchas.md, patterns.md, conventions.md

Only extract genuinely useful, non-obvious learnings. Be concise.'

  var result = ""
  try {
    set result = (echo $prompt | claude --dangerously-skip-permissions --print 2>/dev/null | slurp)
  } catch e {
    ui:warn "Learning extraction failed: "(to-string $e[reason])
    return
  }

  if (str:contains $result "<no-learnings/>") {
    ui:dim "  No notable learnings from this story"
    return
  }

  # Parse and apply learnings
  if (str:contains $result "<learning") {
    # Ensure learnings directory exists
    mkdir -p $learnings-dir

    # Extract each learning block and append to appropriate file
    # Simple parsing - look for <learning file="X"> ... </learning>
    var count = 0
    for file [gotchas.md patterns.md conventions.md] {
      var pattern = '<learning file="'$file'">'
      if (str:contains $result $pattern) {
        try {
          # Extract content between tags
          var content = (echo $result | sed -n '/<learning file="'$file'">/,/<\/learning>/p' | sed '1d;$d')
          if (not (eq (str:trim-space $content) "")) {
            var target = (path:join $learnings-dir $file)
            # Create file if doesn't exist
            if (not (path:is-regular $target)) {
              echo "# "$file > $target
              echo "" >> $target
            }
            echo "" >> $target
            echo $content >> $target
            set count = (+ $count 1)
          }
        } catch _ { }
      }
    }

    if (> $count 0) {
      ui:success "  Extracted "$count" learning(s)"
    } else {
      ui:dim "  No learnings parsed"
    }
  } else {
    ui:dim "  No learnings found in response"
  }
}

# Generate plan-only prompt for a story (no file changes)
fn prepare-plan-prompt {|story-id|
  # Get story details
  var prd-file = (prd:get-prd-file)
  var story-json = ""
  try {
    set story-json = (jq -r '.stories[] | select(.id == "'$story-id'")' $prd-file 2>/dev/null | slurp)
  } catch _ { }

  var title = (echo $story-json | jq -r '.title' | slurp | str:trim-space)
  var acceptance = (echo $story-json | jq -r '.acceptance | join("\n- ")' | slurp | str:trim-space)
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
# Returns: true if valid, false if needs clarification
fn validate-story {|story-id|
  ui:status "Validating story acceptance criteria..."

  # Get story details from prd.json
  var prd-file = (prd:get-prd-file)
  var story-json = ""
  try {
    set story-json = (jq -r '.stories[] | select(.id == "'$story-id'")' $prd-file 2>/dev/null | slurp)
  } catch _ {
    ui:error "Failed to read story "$story-id
    put $false
    return
  }

  if (eq $story-json "") {
    ui:error "Story "$story-id" not found in PRD"
    put $false
    return
  }

  var title = (echo $story-json | jq -r '.title' | slurp | str:trim-space)
  var acceptance = (echo $story-json | jq -r '.acceptance | join("\n- ")' | slurp | str:trim-space)

  if (eq $acceptance "") {
    ui:warn "Story "$story-id" has no acceptance criteria"
    put $false
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
  try {
    set result = (echo $prompt | claude --dangerously-skip-permissions --print 2>/dev/null | slurp)
  } catch e {
    ui:warn "Validation check failed, proceeding anyway: "(to-string $e[reason])
    put $true
    return
  }

  if (str:contains $result "<valid/>") {
    ui:success "Story validation passed"
    put $true
    return
  }

  if (str:contains $result "<needs-clarification>") {
    ui:warn "Story needs clarification:" > /dev/tty
    echo "" > /dev/tty
    # Extract questions between tags
    try {
      echo $result | sed -n '/<needs-clarification>/,/<\/needs-clarification>/p' | grep '^\s*-' > /dev/tty
    } catch _ {
      echo $result > /dev/tty
    }
    echo "" > /dev/tty
    put $false
    return
  }

  # Unexpected response, proceed anyway
  ui:dim "Validation returned unexpected response, proceeding"
  put $true
}
