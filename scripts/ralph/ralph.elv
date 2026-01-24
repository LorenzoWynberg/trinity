#!/usr/bin/env elvish

# Ralph - Autonomous Development Loop for Trinity v0.1
# Main orchestration script - delegates to modules

use str
use re
use path

# Import Ralph modules
use ./lib/ui
use ./lib/cli
use ./lib/state
use ./lib/git
use ./lib/prd
use ./lib/claude
use ./lib/pr

# Get script directory and paths
var script-dir = (path:dir (src)[name])
var project-root = (path:dir (path:dir $script-dir))
var prompt-file = (path:join $script-dir "prompt.md")
var prd-file = (path:join $script-dir "prd.json")
var progress-file = (path:join $script-dir "progress.txt")
var state-file = (path:join $script-dir "state.json")

# Parse arguments and validate
cli:parse-args $args
cli:check-dependencies
cli:check-files $prompt-file $prd-file $progress-file

# Get config
var config = (cli:get-config)

# Load prompt template
var prompt-template = (cat $prompt-file | slurp)

# Initialize modules
state:init $state-file
git:init $project-root $config[base-branch]
prd:init $prd-file
claude:init $project-root $prompt-template $config[claude-timeout] $config[quiet-mode] $config[max-iterations]
pr:init $project-root $config[base-branch] $config[auto-pr] $config[auto-merge]

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
    ui:dim "Could not read state"
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
ui:dim "Base branch:    "$config[base-branch]
ui:dim "Max iterations: "$config[max-iterations]
if $config[quiet-mode] {
  ui:dim "Mode:           quiet (Claude output hidden)"
}
echo ""

# Handle reset mode
if $config[reset-mode] {
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

# Main loop
var current-iteration = 0
var resume-mode = $config[resume-mode]

try {
  while (< $current-iteration $config[max-iterations]) {
    set current-iteration = (+ $current-iteration 1)

    echo ""
    ui:banner "Iteration "$current-iteration" / "$config[max-iterations]

    # Re-read state
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
        ui:warn "No stories available (all complete or blocked)"
        break
      }
      ui:success "Selected: "$story-id

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
          try { gofmt -w (path:join $project-root $f) 2>/dev/null } catch _ { }
        }
        ui:success "  Go formatting complete"
      } else {
        ui:dim "  No Go files need formatting"
      }
    } catch {
      ui:dim "  (no modified files)"
    }
    echo ""

    # Check signals
    ui:status "Checking for completion signals..."
    var signals = (claude:check-signals $output-file $story-id)
    claude:cleanup $output-file
    echo ""

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
      ui:dim "  State saved."

      # Run PR flow
      echo ""
      var story-title = (prd:get-story-title $story-id)
      pr:run-flow $story-id $branch-name $story-title $current-iteration

      # Sync base branch
      echo ""
      git:sync-base-branch

      # Pause before next story
      echo ""
      ui:status "Pausing before next story..."
      echo "\e[33mStop loop? [y/N]\e[0m \e[2m(continues in 120s)\e[0m"
      try {
        var answer = (bash -c 'read -t 120 -n 1 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null)
        if (re:match '^[yY]' $answer) {
          echo ""
          ui:warn "Stopped by user."
          ui:dim "Run again to continue."
          exit 0
        }
      } catch {
        ui:dim "(Timeout - continuing)"
      }
      ui:dim "Continuing to next story..."

    } elif $signals[blocked] {
      echo ""
      ui:error "Story "$story-id" is BLOCKED"
      ui:dim "  Clearing story state..."
      set current-state[status] = "blocked"
      set current-state[current_story] = $nil
      set current-state[branch] = $nil
      set current-state[started_at] = $nil
      set current-state[attempts] = (num 0)
      state:write $current-state
      ui:dim "  State saved."

    } else {
      ui:dim "  Story still in progress..."
    }

    if $signals[all_complete] {
      echo ""
      ui:box "ALL STORIES COMPLETE!" "success"
      ui:dim "Total iterations: "$current-iteration
      exit 0
    }

    sleep 2
  }

  echo ""
  ui:box "MAX ITERATIONS REACHED" "warn"
  ui:dim "Iterations: "$config[max-iterations]
  ui:dim "Run again to continue."
  exit 0
} catch e {
  graceful-exit
}
