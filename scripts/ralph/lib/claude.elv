# Claude invocation for Ralph

use str
use path
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
