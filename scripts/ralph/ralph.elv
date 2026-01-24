#!/usr/bin/env elvish

# Ralph - Autonomous Development Loop for Trinity v0.1
# Iteratively works through tasks from prd.json until complete
# Features: state persistence, self-review cycle, streaming output

use str
use re
use path

# Import Ralph modules
use ./lib/ui
use ./lib/state
use ./lib/git
use ./lib/prd
use ./lib/claude

# Get script directory
var script-dir = (path:dir (src)[name])
var project-root = (path:dir (path:dir $script-dir))

# File paths
var prompt-file = (path:join $script-dir "prompt.md")
var prd-file = (path:join $script-dir "prd.json")
var progress-file = (path:join $script-dir "progress.txt")
var state-file = (path:join $script-dir "state.json")

# Load prompt template
var prompt-template = (cat $prompt-file | slurp)

# Default configuration
var max-iterations = 100
var current-iteration = 0
var base-branch = "dev"
var quiet-mode = $false
var claude-timeout = 1800  # 30 minutes
var auto-pr = $true
var auto-merge = $false

# Parse arguments
var resume-mode = $false
var reset-mode = $false
var i = 0

while (< $i (count $args)) {
  var arg = $args[$i]

  if (or (eq $arg "-h") (eq $arg "--help")) {
    ui:show-help
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
  } elif (eq $arg "--no-auto-pr") {
    set auto-pr = $false
    set i = (+ $i 1)
  } elif (eq $arg "--auto-merge") {
    set auto-merge = $true
    set i = (+ $i 1)
  } else {
    echo "Error: Unknown argument: "$arg >&2
    exit 1
  }
}

# Check for required dependencies
for cmd [jq git claude go gh] {
  if (not (has-external $cmd)) {
    ui:error "Required command '"$cmd"' not found in PATH"
    exit 1
  }
}
ui:dim "Dependencies: jq, git, claude, go, gh ✓"

# Validate required files
for file [$prompt-file $prd-file $progress-file] {
  if (not (path:is-regular $file)) {
    echo "Error: Required file not found: "$file >&2
    exit 1
  }
}
ui:dim "Config files: prompt.md, prd.json, progress.txt ✓"

# Initialize modules
state:init $state-file
git:init $project-root $base-branch
prd:init $prd-file
claude:init $project-root $prompt-template $claude-timeout $quiet-mode $max-iterations

# Graceful exit handler
fn graceful-exit {
  echo ""
  echo ""
  ui:box "INTERRUPTED - Saving State" "warn"

  try {
    var st = (state:read)
    if $st[current_story] {
      ui:dim "Current story: "$st[current_story]
      ui:dim "Branch:        "$st[branch]
      ui:dim "Status:        "$st[status]
    }
    ui:dim "State preserved in state.json"
    ui:dim "Run './ralph.elv --resume' to continue"
  } catch {
    ui:dim "Could not read state (may not have been initialized)"
  }

  echo ""
  ui:warn "Exiting gracefully..."
  exit 130
}

# Print banner
echo ""
ui:box "RALPH - Autonomous Development Loop" "info"
echo ""
ui:dim "Project:        "$project-root
ui:dim "Base branch:    "$base-branch
ui:dim "Max iterations: "$max-iterations
if $quiet-mode {
  ui:dim "Mode:           quiet (Claude output hidden)"
}
echo ""

# Handle reset mode
if $reset-mode {
  ui:status "Resetting state..."
  state:reset
  ui:success "State reset complete."
  echo ""
}

# Read current state
var current-state = (state:read)
ui:dim "Current state:"
ui:dim "  Status:   "$current-state[status]
ui:dim "  Story:    "(if $current-state[current_story] { put $current-state[current_story] } else { put "(none)" })
ui:dim "  Branch:   "(if $current-state[branch] { put $current-state[branch] } else { put "(none)" })
ui:dim "  Attempts: "$current-state[attempts]
echo ""

# Check if all stories are already complete
if (prd:all-stories-complete) {
  ui:success "All stories are complete!"
  echo "<promise>COMPLETE</promise>"
  exit 0
}

# Main loop with interrupt handling
try {
  while (< $current-iteration $max-iterations) {
    set current-iteration = (+ $current-iteration 1)

    echo ""
    ui:banner "Iteration "$current-iteration" / "$max-iterations

    # Re-read state each iteration
    set current-state = (state:read)
    ui:dim "Re-reading state from disk..."

    # Determine story to work on
    var story-id = $nil
    var branch-name = $nil

    if (and $resume-mode $current-state[current_story]) {
      set story-id = $current-state[current_story]
      set branch-name = $current-state[branch]
      ui:status "Resuming story: "$story-id
      set resume-mode = $false
    } elif $current-state[current_story] {
      set story-id = $current-state[current_story]
      set branch-name = $current-state[branch]
      ui:status "Continuing story: "$story-id
    } else {
      ui:status "Finding next story..."
      set story-id = (prd:get-next-story)
      if (eq $story-id "") {
        ui:warn "No stories available (all complete or blocked by dependencies)"
        break
      }
      ui:success "Selected: "$story-id

      # Create branch
      ui:status "Setting up branch..."
      set branch-name = (prd:get-branch-name $story-id)
      git:create-story-branch $branch-name
    }

    if (not $story-id) {
      ui:warn "No story to work on"
      break
    }

    # Update state
    set current-state[current_story] = $story-id
    set current-state[branch] = $branch-name
    set current-state[status] = "in_progress"
    set current-state[attempts] = (+ $current-state[attempts] 1)
    if (not $current-state[started_at]) {
      set current-state[started_at] = (date -u '+%Y-%m-%dT%H:%M:%SZ')
    }
    state:write $current-state

    # Ensure we're on the right branch
    git:ensure-on-branch $branch-name

    # Run Claude
    var output-file = (claude:run $story-id $branch-name $current-state[attempts] $current-iteration "")

    # Format Go files
    echo ""
    ui:status "Formatting Go files..."
    try {
      var go-files = [(git:get-modified-go-files)]
      if (> (count $go-files) 0) {
        for f $go-files {
          try {
            gofmt -w (path:join $project-root $f) 2>/dev/null
          } catch _ { }
        }
        ui:success "  Go formatting complete"
      } else {
        ui:dim "  No Go files need formatting"
      }
    } catch {
      ui:dim "  (no modified files or git error)"
    }
    echo ""

    # Check for completion signals
    ui:status "Checking for completion signals..."
    var signals = (claude:check-signals $output-file $story-id)
    claude:cleanup $output-file
    echo ""

    # Update state based on outcome
    ui:status "Updating state based on outcome..."

    if $signals[complete] {
      echo ""
      ui:success "Story "$story-id" completed!"
      ui:dim "  Resetting state to idle..."
      set current-state[current_story] = $nil
      set current-state[branch] = $nil
      set current-state[status] = "idle"
      set current-state[started_at] = $nil
      set current-state[attempts] = (num 0)
      set current-state[error] = $nil
      state:write $current-state
      ui:dim "  State saved locally."

      # PR and Merge Flow with Feedback Loops
      echo ""
      var pr-url = ""
      var pr-exists = $false
      var refinements = []
      var story-title = (prd:get-story-title $story-id)
      var done-with-pr-flow = $false

      while (not $done-with-pr-flow) {
        # === PR PROMPT ===
        var should-handle-pr = $auto-pr

        # Check if PR already exists
        if (not $pr-exists) {
          try {
            var existing = (gh pr view $branch-name --json url -q '.url' 2>/dev/null | slurp)
            if (not (eq (str:trim-space $existing) "")) {
              set pr-url = (str:trim-space $existing)
              set pr-exists = $true
            }
          } catch _ { }
        }

        if (not $auto-pr) {
          if $pr-exists {
            ui:status "Update PR description?"
          } else {
            ui:status "Create PR to "$base-branch"?"
          }
          echo "\e[33m[Y]es / [n]o / or type feedback for changes\e[0m"
          echo "\e[2m(auto-yes in 120s)\e[0m"

          try {
            var answer = (str:trim-space (bash -c 'read -t 120 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null))
            if (eq $answer "") {
              set should-handle-pr = $true
            } elif (re:match '^[nN]$' $answer) {
              set should-handle-pr = $false
            } elif (re:match '^[yY]$' $answer) {
              set should-handle-pr = $true
            } else {
              # Feedback - run refinement and loop back
              ui:warn "Received feedback, running refinement..."
              set refinements = [$@refinements $answer]
              claude:run $story-id $branch-name "refinement" $current-iteration $answer
              ui:dim "Pushing refinement changes..."
              try {
                git -C $project-root push origin $branch-name 2>&1 | slurp
                ui:success "Changes pushed"
              } catch _ { }
              echo ""
              continue
            }
          } catch {
            ui:dim "(Timeout - proceeding with PR)"
            set should-handle-pr = $true
          }
        }

        # Handle PR create/update
        if $should-handle-pr {
          if $pr-exists {
            ui:status "Updating PR description..."
            try {
              var refinement-notes = ""
              if (> (count $refinements) 0) {
                set refinement-notes = "\n\n## Refinements\n"
                for r $refinements {
                  set refinement-notes = $refinement-notes"- "$r"\n"
                }
              }
              var new-body = "Automated PR for "$story-id$refinement-notes
              gh pr edit $branch-name --body $new-body 2>&1 | slurp
              ui:success "PR updated: "$pr-url
            } catch e {
              ui:error "Failed to update PR: "(to-string $e[reason])
            }
          } else {
            ui:status "Creating PR to "$base-branch"..."
            try {
              set pr-url = (gh pr create --base $base-branch --head $branch-name --title $story-id": "$story-title --body "Automated PR for "$story-id 2>&1 | slurp)
              set pr-url = (str:trim-space $pr-url)
              set pr-exists = $true
              ui:success "PR created: "$pr-url
            } catch e {
              ui:error "Failed to create PR: "(to-string $e[reason])
            }
          }
        } else {
          ui:dim "Skipping PR (branch pushed: "$branch-name")"
          set done-with-pr-flow = $true
          continue
        }

        # === MERGE PROMPT ===
        if (and $pr-exists (not $auto-merge)) {
          echo ""
          ui:status "Merge PR?"
          echo "\e[33m[y]es / [N]o / or type feedback for changes\e[0m"
          echo "\e[2m(auto-no in 120s)\e[0m"

          try {
            var answer = (str:trim-space (bash -c 'read -t 120 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null))
            if (re:match '^[yY]$' $answer) {
              ui:status "Merging PR..."
              try {
                gh pr merge $branch-name --squash --delete-branch 2>&1
                ui:success "PR merged and branch deleted"
              } catch e {
                ui:error "Failed to merge PR: "(to-string $e[reason])
              }
              set done-with-pr-flow = $true
            } elif (or (eq $answer "") (re:match '^[nN]$' $answer)) {
              ui:dim "PR left open for review"
              set done-with-pr-flow = $true
            } else {
              # Feedback - run refinement and go back to PR prompt
              ui:warn "Received feedback, running refinement..."
              set refinements = [$@refinements $answer]
              claude:run $story-id $branch-name "refinement" $current-iteration $answer
              ui:dim "Pushing refinement changes..."
              try {
                git -C $project-root push origin $branch-name 2>&1 | slurp
                ui:success "Changes pushed"
              } catch _ { }
              echo ""
            }
          } catch {
            ui:dim "(Timeout - leaving PR open)"
            set done-with-pr-flow = $true
          }
        } elif $auto-merge {
          ui:status "Auto-merging PR..."
          try {
            gh pr merge $branch-name --squash --delete-branch 2>&1
            ui:success "PR merged and branch deleted"
          } catch e {
            ui:error "Failed to merge PR: "(to-string $e[reason])
          }
          set done-with-pr-flow = $true
        } else {
          set done-with-pr-flow = $true
        }
      }

      # Sync local base branch with remote
      echo ""
      git:sync-base-branch

      # Interactive prompt before next story
      echo ""
      ui:status "Pausing before next story..."
      echo "\e[33mStop loop? [y/N]\e[0m \e[2m(continues in 120s)\e[0m"
      var should-stop = $false
      try {
        var answer = (bash -c 'read -t 120 -n 1 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null)
        if (re:match '^[yY]' $answer) {
          set should-stop = $true
        }
      } catch {
        ui:dim "(Timeout or no TTY - auto-continuing)"
      }
      if $should-stop {
        echo ""
        ui:warn "Stopped by user."
        ui:dim "Run again to continue from next story."
        exit 0
      }
      ui:dim "Continuing to next story..."

    } elif $signals[blocked] {
      echo ""
      ui:error "Story "$story-id" is BLOCKED"
      ui:dim "  Setting status to blocked..."
      set current-state[status] = "blocked"
      state:write $current-state

      ui:dim "  Clearing story state to try next..."
      set current-state[current_story] = $nil
      set current-state[branch] = $nil
      set current-state[started_at] = $nil
      set current-state[attempts] = (num 0)
      state:write $current-state
      ui:dim "  State saved."

    } else {
      ui:dim "  Story still in progress, will continue next iteration..."
    }

    if $signals[all_complete] {
      echo ""
      ui:box "ALL STORIES COMPLETE!" "success"
      ui:dim "Total iterations: "$current-iteration
      exit 0
    }

    # Brief pause between iterations
    sleep 2
  }

  echo ""
  ui:box "MAX ITERATIONS REACHED" "warn"
  ui:dim "Iterations: "$max-iterations
  ui:dim "Run again to continue from current state."
  exit 0
} catch e {
  graceful-exit
}
