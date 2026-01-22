#!/usr/bin/env elvish

# Ralph - Autonomous Development Loop v3
# Iteratively works through tasks from prd.json until complete
# Features: state persistence, self-review cycle, PR automation
# Adapted for JetBrains Elvish Plugin (Gradle/Kotlin)

use str
use re
use path

# Get script directory
var script-dir = (path:dir (src)[name])
var project-root = (path:dir (path:dir $script-dir))

# File paths
var prompt-file = (path:join $script-dir "prompt.md")
var prd-file = (path:join $script-dir "prd.json")
var progress-file = (path:join $script-dir "progress.txt")
var state-file = (path:join $script-dir "state.json")

# Default configuration
var max-iterations = 15
var current-iteration = 0
var base-branch = "main"
var quiet-mode = $false

# ANSI color codes
var C_RESET = "\e[0m"
var C_BOLD = "\e[1m"
var C_DIM = "\e[2m"
var C_CYAN = "\e[36m"
var C_GREEN = "\e[32m"
var C_YELLOW = "\e[33m"
var C_RED = "\e[31m"
var C_MAGENTA = "\e[35m"
var C_BLUE = "\e[34m"

# Styled output helpers
fn ralph-banner {|msg|
  echo $C_CYAN$C_BOLD"═══ RALPH ═══ "$msg$C_RESET
}

fn ralph-status {|msg|
  echo $C_BLUE"► "$C_RESET$msg
}

fn ralph-success {|msg|
  echo $C_GREEN$C_BOLD"✓ "$C_RESET$C_GREEN$msg$C_RESET
}

fn ralph-warn {|msg|
  echo $C_YELLOW"⚠ "$msg$C_RESET
}

fn ralph-error {|msg|
  echo $C_RED$C_BOLD"✗ "$msg$C_RESET
}

fn ralph-dim {|msg|
  echo $C_DIM$msg$C_RESET
}

# Help text
fn show-help {
  echo '
Ralph - Autonomous Development Loop v3 (JetBrains Elvish Plugin)

USAGE:
  ralph.elv [OPTIONS]

OPTIONS:
  --max-iterations <n>    Maximum iterations before auto-stop (default: 15)
  --base-branch <name>    Base branch to create story branches from (default: main)
  --resume                Resume from last state (skip story selection)
  --reset                 Reset state and start fresh
  -q, --quiet             Quiet mode - hide Claude output, show only Ralph status
  -h, --help              Show this help message

FEATURES:
  - Real-time streaming: See Claude output as it happens (via stream-json + jq)
  - State persistence: Tracks current story across invocations
  - Branch naming: Creates feat/story-<phase>.<epic>.<story> branches (e.g., feat/story-4.1.1)
  - Self-review cycle: Agent reviews work, suggests improvements, iterates until done
  - PR automation: Creates PR, merges to main, cleans up branch
  - Error recovery: Can resume interrupted work

WORKFLOW:
  1. Pick next story (respecting dependencies)
  2. Create branch from main (always syncs with latest)
  3. Implement story with verification (./gradlew build)
  4. Self-review: generate suggestions, evaluate, implement worthwhile ones
  5. Repeat review until no more improvements
  6. Create PR, merge to main, delete branch
  7. Move to next story

FILES:
  - prompt.md     : Agent instructions template
  - prd.json      : Task definitions with phase/epic/story mapping
  - progress.txt  : Progress tracking and learnings
  - state.json    : Persistent state between invocations

EXAMPLES:
  ./ralph.elv                          # Start fresh or continue
  ./ralph.elv --resume                 # Force resume current story
  ./ralph.elv --reset                  # Reset state, start fresh
  ./ralph.elv --base-branch develop    # Use alternate base branch
'
}

# Parse arguments
var resume-mode = $false
var reset-mode = $false
var i = 0

while (< $i (count $args)) {
  var arg = $args[$i]

  if (or (eq $arg "-h") (eq $arg "--help")) {
    show-help
    exit 0
  } elif (eq $arg "--max-iterations") {
    var next-idx = (+ $i 1)
    if (>= $next-idx (count $args)) {
      echo "Error: --max-iterations requires a number" >&2
      exit 1
    }
    set max-iterations = (num $args[$next-idx])
    set i = (+ $i 2)
  } elif (eq $arg "--base-branch") {
    var next-idx = (+ $i 1)
    if (>= $next-idx (count $args)) {
      echo "Error: --base-branch requires a branch name" >&2
      exit 1
    }
    set base-branch = $args[$next-idx]
    set i = (+ $i 2)
  } elif (eq $arg "--resume") {
    set resume-mode = $true
    set i = (+ $i 1)
  } elif (eq $arg "--reset") {
    set reset-mode = $true
    set i = (+ $i 1)
  } elif (or (eq $arg "-q") (eq $arg "--quiet")) {
    set quiet-mode = $true
    set i = (+ $i 1)
  } else {
    echo "Error: Unknown argument: "$arg >&2
    exit 1
  }
}

# Check for required dependencies
for cmd [jq git claude prettier] {
  if (not (has-external $cmd)) {
    ralph-error "Required command '"$cmd"' not found in PATH"
    exit 1
  }
}
ralph-dim "Dependencies: jq, git, claude, prettier ✓"

# Validate required files
for file [$prompt-file $prd-file $progress-file] {
  if (not (path:is-regular $file)) {
    echo "Error: Required file not found: "$file >&2
    exit 1
  }
}
ralph-dim "Config files: prompt.md, prd.json, progress.txt ✓"

# Initialize state file if missing
if (not (path:is-regular $state-file)) {
  echo '{"version":1,"current_story":null,"status":"idle","branch":null,"started_at":null,"last_updated":null,"attempts":0,"error":null,"checkpoints":[]}' > $state-file
}

# State management functions
fn read-state {
  cat $state-file | from-json
}

fn write-state {|state|
  var timestamp = (date -u '+%Y-%m-%dT%H:%M:%SZ')
  set state[last_updated] = $timestamp
  put $state | to-json > $state-file
}

fn reset-state {
  var state = [
    &version=(num 1)
    &current_story=$nil
    &status="idle"
    &branch=$nil
    &started_at=$nil
    &last_updated=$nil
    &attempts=(num 0)
    &error=$nil
    &checkpoints=[]
  ]
  write-state $state
}

# Git helper functions
fn current-branch {
  str:trim-space (git -C $project-root rev-parse --abbrev-ref HEAD | slurp)
}

fn branch-exists {|branch|
  try {
    # Check local branches
    git -C $project-root rev-parse --verify "refs/heads/"$branch > /dev/null 2>&1
    put $true
  } catch {
    try {
      # Check remote branches
      git -C $project-root rev-parse --verify "refs/remotes/origin/"$branch > /dev/null 2>&1
      put $true
    } catch {
      put $false
    }
  }
}

# Get story info including phase/epic/story_number for branch naming
fn get-story-info {|story-id|
  # Use underscore var for interpolation compatibility
  var sid = $story-id
  var pf = $prd-file
  var query = ".stories[] | select(.id == \""$sid"\") | \"\\(.phase)\\t\\(.epic)\\t\\(.story_number)\""
  jq -r $query $pf
}

# Always branch from BASE_BRANCH (main) since PRs merge there and feature branches are deleted

fn create-story-branch {|story-id|
  # Get story info for branch naming
  var info = (str:trim-space (get-story-info $story-id | slurp))
  if (eq $info "") {
    ralph-error "Failed to get story info for "$story-id
    fail "Story not found in PRD"
  }
  var parts = [(str:split "\t" $info)]
  if (< (count $parts) 3) {
    ralph-error "Invalid story info format for "$story-id": "$info
    fail "Invalid story info"
  }
  var phase = $parts[0]
  var epic = $parts[1]
  var story-num = $parts[2]

  # New branch naming: feat/story-<phase>.<epic>.<story_number>
  var branch-name = "feat/story-"$phase"."$epic"."$story-num

  # Check if branch already exists
  if (branch-exists $branch-name) {
    echo "  Branch "$branch-name" already exists, switching to it" >&2
    git -C $project-root checkout $branch-name > /dev/null 2>&1
  } else {
    echo "  Creating branch "$branch-name" from "$base-branch >&2
    git -C $project-root fetch origin $base-branch > /dev/null 2>&1
    git -C $project-root checkout $base-branch > /dev/null 2>&1
    git -C $project-root reset --hard origin/$base-branch > /dev/null 2>&1
    git -C $project-root checkout -b $branch-name > /dev/null 2>&1
  }

  put $branch-name
}

fn ensure-on-branch {|branch|
  var current = (current-branch)
  if (not (eq $current $branch)) {
    # Check if branch exists
    if (branch-exists $branch) {
      echo "  Switching to branch "$branch >&2
      git -C $project-root checkout $branch > /dev/null 2>&1
    } else {
      # Branch missing - recreate from base branch
      echo "  Branch "$branch" not found, recreating from "$base-branch >&2
      git -C $project-root fetch origin $base-branch > /dev/null 2>&1
      git -C $project-root checkout $base-branch > /dev/null 2>&1
      git -C $project-root reset --hard origin/$base-branch > /dev/null 2>&1
      git -C $project-root checkout -b $branch > /dev/null 2>&1
    }
  }
}

# Get next story from prd.json (respects dependencies)
fn get-next-story {
  var pf = $prd-file

  # Get all story IDs that have passes=true (completed)
  var completed = [(jq -r '.stories[] | select(.passes == true) | .id' $pf)]

  # Get stories that are not complete
  var candidates = [(jq -r '.stories[] | select(.passes != true) | "\(.id)|\(.depends_on // [] | join(","))"' $pf)]

  for candidate $candidates {
    var parts = [(str:split "|" $candidate)]
    var sid = $parts[0]
    var deps-str = $parts[1]

    # Check if all dependencies are completed
    var deps-met = $true
    if (not (eq $deps-str "")) {
      var deps = [(str:split "," $deps-str)]
      for dep $deps {
        var found = $false
        for c $completed {
          if (eq $c $dep) {
            set found = $true
            break
          }
        }
        if (not $found) {
          set deps-met = $false
          break
        }
      }
    }

    if $deps-met {
      put $sid
      return
    }
  }

  put $nil
}

# Check if all stories are complete
fn all-stories-complete {
  var pf = $prd-file
  # Count stories without passes=true
  var incomplete = (jq '[.stories[] | select(.passes != true)] | length' $pf)
  eq $incomplete "0"
}

# Get dependency info for a story
fn get-story-deps {|story-id|
  var sid = $story-id
  var pf = $prd-file

  # Get dependencies for the story as newline-separated list
  var deps-query = ".stories[] | select(.id == \""$sid"\") | .depends_on // [] | .[]"
  var deps = [(jq -r $deps-query $pf)]

  if (eq (count $deps) 0) {
    echo "None (this story has no dependencies)"
  } else {
    for did $deps {
      var info-query = ".stories[] | select(.id == \""$did"\") | \"\\(.title)|\\(.passes // false)\""
      var dep-info = (jq -r $info-query $pf)
      var parts = [(str:split "|" $dep-info)]
      var title = $parts[0]
      var passes = $parts[1]
      var status = "PENDING"
      if (eq $passes "true") {
        set status = "DONE"
      }
      echo "- "$did": "$title" ["$status"]"
    }
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
    # List files matching date pattern, excluding README
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

# Read prompt template
var prompt-template = (cat $prompt-file | slurp)

echo ""
echo $C_CYAN$C_BOLD"╔════════════════════════════════════════════════════════╗"$C_RESET
echo $C_CYAN$C_BOLD"║         RALPH - Autonomous Development Loop v3         ║"$C_RESET
echo $C_CYAN$C_BOLD"║           JetBrains Elvish Plugin Edition              ║"$C_RESET
echo $C_CYAN$C_BOLD"╚════════════════════════════════════════════════════════╝"$C_RESET
echo ""
ralph-dim "Project:        "$project-root
ralph-dim "Base branch:    "$base-branch
ralph-dim "Max iterations: "$max-iterations
if $quiet-mode {
  ralph-dim "Mode:           quiet (Claude output hidden)"
}
echo ""

# Handle reset mode
if $reset-mode {
  ralph-status "Resetting state..."
  reset-state
  ralph-success "State reset complete."
  echo ""
}

# Read current state
var state = (read-state)

ralph-dim "Current state:"
ralph-dim "  Status:   "$state[status]
ralph-dim "  Story:    "(if $state[current_story] { put $state[current_story] } else { put "(none)" })
ralph-dim "  Branch:   "(if $state[branch] { put $state[branch] } else { put "(none)" })
ralph-dim "  Attempts: "$state[attempts]
echo ""

# Check if all stories are already complete
if (all-stories-complete) {
  echo "All stories are complete!"
  echo "<promise>COMPLETE</promise>"
  exit 0
}

# Main loop
while (< $current-iteration $max-iterations) {
  set current-iteration = (+ $current-iteration 1)

  echo ""
  ralph-banner "Iteration "$current-iteration" / "$max-iterations

  # Re-read state each iteration (like ralph.sh)
  set state = (read-state)
  ralph-dim "Re-reading state from disk..."

  # Determine story to work on
  var story-id = $nil
  var branch-name = $nil

  if (and $resume-mode $state[current_story]) {
    # Resume mode: continue with current story
    set story-id = $state[current_story]
    set branch-name = $state[branch]
    ralph-status "Resuming story: "$C_YELLOW$story-id$C_RESET
  } elif $state[current_story] {
    # State has a current story
    if (eq $state[status] "in_progress") {
      # Continue with current story
      set story-id = $state[current_story]
      set branch-name = $state[branch]
      ralph-status "Continuing story: "$C_YELLOW$story-id$C_RESET
    } else {
      # Previous story completed or failed, get next
      set story-id = (get-next-story)
      if $story-id {
        ralph-status "Starting new story: "$C_YELLOW$story-id$C_RESET
        set branch-name = (create-story-branch $story-id)
      }
    }
  } else {
    # No current story, get next
    set story-id = (get-next-story)
    if $story-id {
      ralph-status "Starting story: "$C_YELLOW$story-id$C_RESET
      set branch-name = (create-story-branch $story-id)
    }
  }

  # Check if we have a story to work on
  if (not $story-id) {
    ralph-warn "No more stories to work on."
    if (all-stories-complete) {
      echo "<promise>COMPLETE</promise>"
    }
    break
  }

  # Update state
  set state[current_story] = $story-id
  set state[branch] = $branch-name
  set state[status] = "in_progress"
  set state[attempts] = (+ $state[attempts] 1)
  if (not $state[started_at]) {
    set state[started_at] = (date -u '+%Y-%m-%dT%H:%M:%SZ')
  }
  write-state $state

  # Ensure we're on the right branch
  ensure-on-branch $branch-name

  # Prepare prompt with context
  var iteration-prompt = (str:replace &max=-1 "{{ITERATION}}" (to-string $current-iteration) $prompt-template)
  set iteration-prompt = (str:replace &max=-1 "{{MAX_ITERATIONS}}" (to-string $max-iterations) $iteration-prompt)
  set iteration-prompt = (str:replace &max=-1 "{{CURRENT_STORY}}" $story-id $iteration-prompt)
  set iteration-prompt = (str:replace &max=-1 "{{BRANCH}}" $branch-name $iteration-prompt)
  set iteration-prompt = (str:replace &max=-1 "{{ATTEMPT}}" (to-string $state[attempts]) $iteration-prompt)

  # Add dependency info
  var deps-info = (get-story-deps $story-id | slurp)
  set iteration-prompt = (str:replace &max=-1 "{{DEPENDENCIES}}" $deps-info $iteration-prompt)

  # Add recent activity logs for learning
  var activity-logs = (get-recent-activity-logs | slurp)
  set iteration-prompt = (str:replace &max=-1 "{{RECENT_ACTIVITY_LOGS}}" $activity-logs $iteration-prompt)

  # Run Claude
  var output-file = (mktemp)

  # Get story title for display
  var story-title = (jq -r ".stories[] | select(.id == \""$story-id"\") | .title" $prd-file)

  ralph-status "Running Claude (attempt "$state[attempts]")..."
  ralph-dim "  Story:  "$story-id
  ralph-dim "  Title:  "$story-title
  ralph-dim "  Branch: "$branch-name
  ralph-dim "  Output: "$output-file
  echo ""

  ralph-status "Invoking Claude CLI..."
  ralph-dim "  This may take several minutes. Claude is working autonomously."
  if $quiet-mode {
    ralph-dim "  Quiet mode: output captured to file only."
  } else {
    ralph-dim "  Streaming mode: real-time output via stream-json + jq."
  }
  ralph-dim "  Waiting for completion signal..."
  echo ""
  echo $C_DIM"────────────────── Claude Working ──────────────────"$C_RESET

  cd $project-root
  var claude-start = (date +%s)
  var claude-timeout = 1800  # 30 minutes
  var prompt-tmp = (mktemp)
  echo $iteration-prompt > $prompt-tmp
  try {
    if $quiet-mode {
      # Quiet mode: capture output to file, no streaming
      timeout $claude-timeout bash -c 'claude --dangerously-skip-permissions --print < "$1"' _ $prompt-tmp > $output-file 2>&1
    } else {
      # Streaming mode: native Elvish pipeline with jq filtering
      var stream-text = 'select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
      var final-result = 'select(.type == "result").result // empty'

      try {
        timeout $claude-timeout claude --dangerously-skip-permissions --verbose --print --output-format stream-json < $prompt-tmp 2>&1 | grep --line-buffered '^{' | tee $output-file | jq --unbuffered -rj $stream-text 2>/dev/null
      } catch _ { }

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
    echo $C_DIM"───────────────────────────────────────────────────"$C_RESET
    ralph-success "Claude execution completed in "$claude-duration"s"
  } catch e {
    var claude-end = (date +%s)
    var claude-duration = (- $claude-end $claude-start)
    echo $C_DIM"───────────────────────────────────────────────────"$C_RESET
    if (>= $claude-duration $claude-timeout) {
      ralph-error "Claude execution TIMED OUT after "$claude-timeout"s"
    } else {
      ralph-error "Claude execution error: "(to-string $e[reason])
    }
  } finally {
    rm -f $prompt-tmp
    rm -f $output-file".result" 2>/dev/null
  }

  # Show output file size as indicator of activity
  var file-size = "unknown"
  try {
    set file-size = (stat -f%z $output-file)
  } catch _ { }
  ralph-dim "  Output size: "$file-size" bytes"
  echo ""

  # Auto-format modified files (JSON, MD, etc.)
  ralph-status "Checking for modified files to format..."
  try {
    var modified-files = [(git -C $project-root diff --name-only HEAD 2>/dev/null)]
    ralph-dim "  Found "(count $modified-files)" modified file(s)"

    var prettier-files = []
    for f $modified-files {
      if (re:match '\.(js|jsx|ts|tsx|mjs|cjs|json|md)$' $f) {
        set prettier-files = [$@prettier-files $f]
      }
    }
    if (> (count $prettier-files) 0) {
      ralph-dim "  Running prettier on "(count $prettier-files)" file(s)..."
      prettier --write $@prettier-files > /dev/null 2>&1
      ralph-success "  Prettier formatting complete"
    } else {
      ralph-dim "  No files need formatting"
    }
  } catch {
    ralph-dim "  (no modified files or git error)"
  }
  echo ""

  # Check for completion signals
  ralph-status "Checking for completion signals..."
  var story-complete = $false
  var story-blocked = $false
  var all-complete = $false
  var sid = $story-id

  try {
    grep -q '<story-complete>'$sid'</story-complete>' $output-file
    set story-complete = $true
    ralph-dim "  Found: <story-complete>"
  } catch { }

  try {
    grep -q '<story-blocked>'$sid'</story-blocked>' $output-file
    set story-blocked = $true
    ralph-dim "  Found: <story-blocked>"
  } catch { }

  try {
    grep -q '<promise>COMPLETE</promise>' $output-file
    set all-complete = $true
    ralph-dim "  Found: <promise>COMPLETE</promise>"
  } catch { }

  if (and (not $story-complete) (not $story-blocked) (not $all-complete)) {
    ralph-dim "  No completion signal found (story still in progress)"
  }

  rm -f $output-file
  ralph-dim "  Cleaned up temp file"
  echo ""

  # Update state based on outcome
  ralph-status "Updating state based on outcome..."
  if $story-complete {
    echo ""
    ralph-success "Story "$story-id" completed!"
    ralph-dim "  Resetting state to idle..."
    set state[current_story] = $nil
    set state[branch] = $nil
    set state[status] = "idle"
    set state[started_at] = $nil
    set state[attempts] = (num 0)
    set state[error] = $nil
    write-state $state
    ralph-dim "  State saved locally."

    # Sync local main with remote (PR was merged, so pull latest)
    ralph-dim "  Syncing local main with remote..."
    try {
      git -C $project-root fetch origin main > /dev/null 2>&1
      git -C $project-root checkout main > /dev/null 2>&1
      git -C $project-root reset --hard origin/main > /dev/null 2>&1
      ralph-success "  Local main synced with remote."
    } catch {
      ralph-dim "  (main sync skipped - may need manual intervention)"
    }

    # Interactive prompt: chance to stop before next story (20s auto-continue)
    echo ""
    ralph-status "Pausing before next story..."
    echo $C_YELLOW"Stop loop? [y/N] "$C_DIM"(continues in 20s)"$C_RESET
    var should-stop = $false
    try {
      var answer = (bash -c 'read -t 20 -n 1 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null)
      if (re:match '^[yY]' $answer) {
        set should-stop = $true
      }
    } catch {
      # Timeout or error - continue
      ralph-dim "(Timeout or no TTY - auto-continuing)"
    }
    if $should-stop {
      echo ""
      ralph-warn "Stopped by user."
      ralph-dim "Run again to continue from next story."
      exit 0
    }
    if (not $should-stop) {
      ralph-dim "Continuing to next story..."
    }
  } elif $story-blocked {
    echo ""
    ralph-error "Story "$story-id" is BLOCKED"
    ralph-dim "  Setting status to blocked..."
    set state[status] = "blocked"
    write-state $state
    # Move to next story
    ralph-dim "  Clearing story state to try next..."
    set state[current_story] = $nil
    set state[branch] = $nil
    set state[started_at] = $nil
    set state[attempts] = (num 0)
    write-state $state
    ralph-dim "  State saved."
  } else {
    ralph-dim "  Story still in progress, will continue next iteration..."
  }

  if $all-complete {
    echo ""
    echo $C_GREEN$C_BOLD"╔════════════════════════════════════════════════════════╗"$C_RESET
    echo $C_GREEN$C_BOLD"║              ALL STORIES COMPLETE!                     ║"$C_RESET
    echo $C_GREEN$C_BOLD"╚════════════════════════════════════════════════════════╝"$C_RESET
    ralph-dim "Total iterations: "$current-iteration
    exit 0
  }

  # Brief pause between iterations
  sleep 2
}

echo ""
echo $C_YELLOW$C_BOLD"╔════════════════════════════════════════════════════════╗"$C_RESET
echo $C_YELLOW$C_BOLD"║              MAX ITERATIONS REACHED                    ║"$C_RESET
echo $C_YELLOW$C_BOLD"╚════════════════════════════════════════════════════════╝"$C_RESET
ralph-dim "Iterations: "$max-iterations
ralph-dim "Run again to continue from current state."
exit 0
