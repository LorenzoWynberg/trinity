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
