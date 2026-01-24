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

# Run Claude with the full prompt template
fn run {|story-id branch-name attempt iteration feedback|
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
  var prompt-tmp = (mktemp)
  echo $prompt > $prompt-tmp

  # Get story title for display
  var story-title = (prd:get-story-title $story-id)

  var mode-label = "attempt "$attempt
  if (not (eq $feedback "")) {
    set mode-label = "refinement"
  }

  ui:status "Running Claude ("$mode-label")..."
  ui:dim "  Story:  "$story-id
  ui:dim "  Title:  "$story-title
  ui:dim "  Branch: "$branch-name
  ui:dim "  Output: "$output-file
  if (not (eq $feedback "")) {
    ui:dim "  Feedback: "$feedback
  }
  echo ""

  ui:status "Invoking Claude CLI..."
  ui:dim "  This may take several minutes. Claude is working autonomously."
  if $quiet-mode {
    ui:dim "  Quiet mode: output captured to file only."
  } else {
    ui:dim "  Streaming mode: real-time output."
  }
  ui:dim "  Waiting for completion signal..."
  echo ""

  ui:divider "Claude Working"

  cd $project-root
  var claude-start = (date +%s)
  var run-success = $true

  try {
    if $quiet-mode {
      timeout $claude-timeout bash -c 'claude --dangerously-skip-permissions --print < "$1"' _ $prompt-tmp > $output-file 2>&1
    } else {
      var stream-text = 'select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
      var final-result = 'select(.type == "result").result // empty'

      # Run streaming pipeline - output goes directly to terminal
      # Note: Output may take a moment to appear as Claude starts processing
      timeout $claude-timeout claude --dangerously-skip-permissions --verbose --print --output-format stream-json < $prompt-tmp 2>&1 | ^
        grep --line-buffered '^{' | ^
        tee $output-file | ^
        jq --unbuffered -rj $stream-text

      # Extract final result text for signal detection
      try {
        jq -rs $final-result $output-file > $output-file".result" 2>/dev/null
      } catch _ { }

      # Use the extracted result if available
      if (path:is-regular $output-file".result") {
        var result-content = (cat $output-file".result" | slurp)
        if (not (eq $result-content "")) {
          echo $result-content > $output-file
        }
        rm -f $output-file".result"
      }
    }
    var claude-end = (date +%s)
    var claude-duration = (- $claude-end $claude-start)
    ui:divider-end
    ui:success "Claude execution completed in "$claude-duration"s"
  } catch e {
    set run-success = $false
    var claude-end = (date +%s)
    var claude-duration = (- $claude-end $claude-start)
    ui:divider-end
    if (>= $claude-duration $claude-timeout) {
      ui:error "Claude execution TIMED OUT after "$claude-timeout"s"
    } else {
      ui:error "Claude execution error: "(to-string $e[reason])
    }
  } finally {
    rm -f $prompt-tmp
    rm -f $output-file".result" 2>/dev/null
  }

  # Return output file path for signal detection
  put $output-file
}

# Run refinement (convenience wrapper)
fn run-refinement {|story-id branch-name feedback iteration|
  run $story-id $branch-name "refinement" $iteration $feedback
}

# Check output file for completion signals
fn check-signals {|output-file story-id|
  var story-complete = $false
  var story-blocked = $false
  var all-complete = $false

  try {
    grep -q '<story-complete>'$story-id'</story-complete>' $output-file
    set story-complete = $true
    ui:dim "  Found: <story-complete>"
  } catch { }

  try {
    grep -q '<story-blocked>'$story-id'</story-blocked>' $output-file
    set story-blocked = $true
    ui:dim "  Found: <story-blocked>"
  } catch { }

  try {
    grep -q '<promise>COMPLETE</promise>' $output-file
    set all-complete = $true
    ui:dim "  Found: <promise>COMPLETE</promise>"
  } catch { }

  if (and (not $story-complete) (not $story-blocked) (not $all-complete)) {
    ui:dim "  No completion signal found (story still in progress)"
  }

  # Return as map
  put [&complete=$story-complete &blocked=$story-blocked &all_complete=$all-complete]
}

# Cleanup output file
fn cleanup {|output-file|
  rm -f $output-file
  ui:dim "  Cleaned up temp file"
}
