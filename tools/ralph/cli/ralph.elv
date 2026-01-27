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
use ./lib/metrics
use ./lib/release
use ./lib/gotchas
use ./lib/format

# Get script directory and paths
var script-dir = (path:dir (src)[name])
var project-root = (path:dir (path:dir $script-dir))
var prompt-file = (path:join $script-dir "prompt.md")
var prd-dir = (path:join $script-dir "prd")
var progress-file = (path:join $script-dir "progress.txt")
var state-file = (path:join $script-dir "state.json")
var metrics-file = (path:join $script-dir "metrics.json")

# Parse arguments and validate
cli:parse-args $args
cli:check-dependencies

# Get config
var config = (cli:get-config)

# Initialize PRD module with directory
prd:init $prd-dir

# Select version (auto or by flag)
var active-version = (prd:select-version $config[target-version])
if (eq $active-version "") {
  if (not (eq $config[target-version] "")) {
    ui:warn "Couldn't find version "$config[target-version]
    ui:dim "Check the prd/ directory for available version files (e.g., v1.0.json)"
    ui:dim "Available: "(str:join ", " [(prd:list-versions)])
  } else {
    ui:success "All versions complete! Nothing left to do."
  }
  exit 0
}

# Now check files (with selected PRD file)
var prd-file = (prd:get-prd-file)
cli:check-files $prompt-file $prd-file $progress-file

# Load prompt template
var prompt-template = (cat $prompt-file | slurp)

# Initialize remaining modules
state:init $state-file &root=$project-root
git:init $project-root $config[base-branch]
claude:init $project-root $script-dir $prompt-template $config[claude-timeout] $config[quiet-mode] $config[max-iterations] &auto-handle-dup=$config[auto-handle-duplicates] &auto-add-rev-deps=$config[auto-add-reverse-deps] &auto-upd-related=$config[auto-update-related]
pr:init $project-root $config[base-branch] $config[auto-pr] $config[auto-merge]
metrics:init $metrics-file
release:init $project-root $config[base-branch] "main" $config[claude-timeout]
gotchas:init $project-root &base=$config[base-branch]

# Check if learnings need compaction (monthly maintenance)
gotchas:check-and-compact

# Handle status mode (show and exit)
if $config[status-mode] {
  echo ""
  prd:show-status
  # Show current state
  var current-state = (state:read)
  if $current-state[current_story] {
    echo ""
    echo "Current work:"
    echo "  Story:  "$current-state[current_story]
    echo "  Branch: "$current-state[branch]
    echo "  Status: "$current-state[status]
  }
  exit 0
}

# Handle stats mode (show metrics and exit)
if $config[stats-mode] {
  echo ""
  metrics:show-stats
  exit 0
}

# Handle version status mode (show version progress and exit)
if $config[version-status-mode] {
  echo ""
  prd:show-version-status
  exit 0
}

# Handle plan mode (generate plan and exit)
if $config[plan-mode] {
  echo ""

  # Get next story (or current)
  var current-state = (state:read)
  var story-id = ""

  if $current-state[current_story] {
    set story-id = $current-state[current_story]
  } else {
    if (not (eq $config[target-version] "")) {
      set story-id = (prd:get-next-story-for-version $config[target-version])
    } else {
      set story-id = (prd:get-next-story)
    }
    if (eq $story-id "") {
      ui:warn "No stories available to plan"
      exit 0
    }
  }

  claude:run-plan-mode $story-id $config[target-version]
  exit 0
}

# Handle refine-prd mode (review stories and suggest improvements)
if $config[refine-prd-mode] {
  echo ""
  claude:refine-prd &story-id=$config[refine-prd-target] &version=$config[target-version]
  exit 0
}

# Handle add-stories mode (generate stories from description)
if $config[add-stories-mode] {
  echo ""
  claude:add-stories-from-description $config[add-stories-description] &version=$config[target-version]
  exit 0
}

# Archive old activity logs on startup
claude:archive-old-logs

# Run pre-flight checks
var preflight-ok = $true
try {
  set preflight-ok = (claude:preflight-checks | take 1)
} catch _ {
  set preflight-ok = $false
}
if (not $preflight-ok) {
  ui:warn "Pre-flight checks failed. Fix issues above or proceed with caution."
  echo "\e[33mContinue anyway? [y/n]\e[0m"
  try {
    var answer = (bash -c 'read -n 1 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null)
    if (not (re:match '^[yY]' $answer)) {
      echo ""
      ui:status "Aborted. Fix issues and run again."
      exit 1
    }
  } catch {
    exit 1
  }
  echo ""
}

# Print banner
echo ""
ui:box "RALPH - Autonomous Development Loop" "info"
echo ""
ui:dim "Project:        "$project-root
ui:dim "Base branch:    "$config[base-branch]
ui:dim "Target version: "$active-version" (prd/"$active-version".json)"
ui:dim "Max iterations: "$config[max-iterations]
if $config[quiet-mode] {
  ui:dim "Mode:           quiet (Claude output hidden)"
}
if (and $config[auto-pr] $config[auto-merge] $config[auto-clarify]) {
  ui:warn "YOLO mode: auto-clarify, auto-PR, auto-merge"
}
echo ""

# Handle reset mode
if $config[reset-mode] {
  ui:status "Resetting state..."
  state:reset
  ui:success "State reset complete."
  echo ""
}

# Handle retry-clean mode
if (not (eq $config[retry-clean-story] "")) {
  state:handle-retry-clean $config[retry-clean-story]
  exit 0
}

# Handle skip mode
if (not (eq $config[skip-story-id] "")) {
  prd:handle-skip $config[skip-story-id] $config[skip-reason] $project-root
  exit 0
}

# Handle --story ID mode: validate story and check deps before starting
var single-story-mode = $false
var single-story-id = ""
if (not (eq $config[single-story-id] "")) {
  set single-story-mode = $true
  set single-story-id = (prd:normalize-story-id $config[single-story-id])

  # Check story exists
  if (not (prd:story-exists $single-story-id)) {
    ui:warn "Couldn't find "$single-story-id" in the PRD"
    ui:dim "Check the story ID format (e.g., STORY-1.2.3 or just 1.2.3)"
    ui:dim "Use ./ralph.elv --status to see available stories"
    exit 1
  }

  # Check deps are met
  var deps-ok = [(prd:show-story-dep-status $single-story-id)]
  if (not $deps-ok[-1]) {
    echo ""
    ui:dim "Merge the blocking PRs or wait for in-progress work to complete."
    exit 1
  }

  ui:success "Dependencies met - ready to work on "$single-story-id
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
  echo ""
  ui:box "All done! Ready to ship "$active-version "success"
  metrics:show-celebration

  var release-result = (release:run-full-flow $active-version &skip-release=$config[skip-release] &auto-release=$config[auto-release] &notify-enabled=$config[notify-enabled])

  echo "<promise>COMPLETE</promise>"
  if (and (has-key $release-result error) $release-result[error]) {
    exit 1
  }
  exit 0
}

# Check for passed-but-not-merged stories (need to merge before continuing)
var unmerged = [(prd:get-unmerged-passed)]
pr:handle-unmerged $unmerged

# Main loop
var current-iteration = 0
var resume-mode = $config[resume-mode]
var pending-feedback = ""  # Feedback from PR review to pass to next Claude run
var pending-clarification = ""  # Clarification from validation questions to pass to Claude
var pending-ext-deps-report = ""  # External deps report to pass to Claude
var pending-failure-context = ""  # Previous failure context for smart retry

while (< $current-iteration $config[max-iterations]) {
    set current-iteration = (+ $current-iteration 1)

    echo ""
    ui:banner "Iteration "$current-iteration" / "$config[max-iterations]

    # Show progress summary
    var progress = (prd:get-progress-stats)
    echo ""
    ui:dim "Progress: "$progress[merged]"/"$progress[total]" stories merged ("$progress[pct]"%)"

    # Show per-phase progress bars
    var phase-progress = (prd:get-phase-progress)
    for p $phase-progress {
      var bar = (ui:progress-bar $p[merged] $p[total])
      ui:dim "  "$p[name]": "$bar" "$p[merged]"/"$p[total]
    }
    echo ""

    # Re-read state
    set current-state = (state:read)
    ui:dim "Re-reading state from disk..."

    # Determine story to work on
    var story-id = $nil
    var branch-name = $nil
    var skip-to-stage = ""  # For checkpoint-based resume
    var validation-done = $false  # Track if validation already done this iteration

    if (and $resume-mode $current-state[current_story]) {
      set story-id = $current-state[current_story]
      set branch-name = $current-state[branch]
      ui:status "Resuming story: "$story-id

      # Check for checkpoints to resume from
      # Check checkpoints from most advanced to least
      if (state:has-checkpoint $story-id "pr_created") {
        set skip-to-stage = "pr_flow"
        ui:status "Resuming from checkpoint: PR created → merge flow"
      } elif (state:has-checkpoint $story-id "claude_complete") {
        set skip-to-stage = "pr_flow"
        ui:status "Resuming from checkpoint: Claude complete → PR flow"
      } elif (state:has-checkpoint $story-id "validation_complete") {
        set skip-to-stage = "claude"
        ui:status "Resuming from checkpoint: validation → Claude"
      } elif (state:has-checkpoint $story-id "branch_created") {
        set skip-to-stage = "validation"
        ui:status "Resuming from checkpoint: branch → validation"
      }
      # claude_started doesn't allow resume (can't resume mid-Claude)

      set resume-mode = $false
    } elif $current-state[current_story] {
      set story-id = $current-state[current_story]
      set branch-name = $current-state[branch]
      ui:status "Continuing story: "$story-id
    } else {
      # NEW STORY - validate BEFORE creating branch to avoid wasted branches on skip

      # Check if we're in single-story mode
      if $single-story-mode {
        set story-id = $single-story-id
        ui:status "Working on specified story: "$story-id
      } else {
        ui:status "Finding next story..."
        if (not (eq $config[target-version] "")) {
          ui:dim "  Filtering for version: "$config[target-version]
          set story-id = (prd:get-next-story-for-version $config[target-version])
        } else {
          set story-id = (prd:get-next-story)
        }
        if (eq $story-id "") {
          # Distinguish between "all complete" and "blocked"
          if (prd:all-stories-complete) {
            # All stories merged - will be handled by all_complete signal check
            ui:success "All stories merged!"
            exit 0
          } else {
            # Stories exist but are blocked - use friendly message
            prd:show-nothing-runnable
            exit 0
          }
        }
        ui:success "Selected: "$story-id
      }

      # Validate story BEFORE branch creation (unless feedback mode or already have clarification)
      if (and (eq $pending-feedback "") (eq $pending-clarification "")) {
        var validate-results = [(claude:validate-story $story-id)]
        var validation = [&valid=$true &questions=""]
        if (> (count $validate-results) 0) {
          set validation = $validate-results[-1]
        }
        if (not $validation[valid]) {
          echo "" > /dev/tty

          # Handle auto-clarify flag - automatically proceed with assumptions
          if $config[auto-clarify] {
            ui:dim "Auto-clarify enabled, proceeding with reasonable assumptions..." > /dev/tty
            set pending-clarification = "Auto-clarify mode: Make reasonable assumptions based on the codebase context and existing patterns. If unsure, choose the simpler implementation."
          } else {
            ui:warn "Story "$story-id" needs clarification before implementation." > /dev/tty
            echo "" > /dev/tty
            echo "What would you like to do?" > /dev/tty
            echo "\e[33m  [s]kip\e[0m     - Move to the next story" > /dev/tty
            echo "\e[33m  [c]larify\e[0m  - Answer these questions (opens editor)" > /dev/tty
            echo "\e[33m  [a]uto\e[0m     - Let Ralph make reasonable assumptions" > /dev/tty
            echo "\e[33m  [q]uit\e[0m     - Stop and fix the story manually" > /dev/tty
            echo "" > /dev/tty
            echo "\e[33mChoice [s/c/a/q]:\e[0m " > /dev/tty
            try {
              var answer = (bash -c 'read -n 1 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null)
              echo "" > /dev/tty
              if (re:match '^[qQ]' $answer) {
                echo ""
                ui:status "Stopping. Clarify the story and run again."
                exit 0
              } elif (re:match '^[cC]' $answer) {
                set pending-clarification = (prd:get-clarification $story-id $validation[questions])
                if (eq $pending-clarification "") {
                  ui:dim "No clarification provided, skipping story..." > /dev/tty
                  continue
                }
                ui:success "Clarification received, proceeding with implementation..." > /dev/tty
              } elif (re:match '^[aA]' $answer) {
                ui:dim "Proceeding with reasonable assumptions..." > /dev/tty
                set pending-clarification = "Auto-proceed mode: Make reasonable assumptions based on the codebase context and existing patterns. If unsure, choose the simpler implementation."
              } else {
                # Default or 's' - skip story (NO BRANCH CREATED - this is the fix)
                ui:dim "Skipping story, moving to next..." > /dev/tty
                continue
              }
            } catch { }
          }
        }
      }

      # Check external deps BEFORE branch creation
      if (and (eq $pending-feedback "") (eq $pending-ext-deps-report "")) {
        if (prd:has-external-deps $story-id) {
          echo "" > /dev/tty
          ui:warn "Story "$story-id" has external dependencies:" > /dev/tty
          echo "" > /dev/tty
          var deps = [(prd:get-external-deps $story-id)]
          for dep $deps {
            var parts = [(str:split "|" $dep)]
            var name = $parts[0]
            var desc = ""
            if (> (count $parts) 1) {
              set desc = $parts[1]
            }
            ui:dim "  • "$name": "$desc > /dev/tty
          }
          echo "" > /dev/tty
          echo "Claude needs to know how these were implemented." > /dev/tty
          echo "\e[33m  [r]eport\e[0m - Describe the implementation (opens editor)" > /dev/tty
          echo "\e[33m  [s]kip\e[0m   - Skip this story for now" > /dev/tty
          echo "" > /dev/tty
          echo "\e[33mChoice [r/s]:\e[0m " > /dev/tty
          try {
            var answer = (bash -c 'read -n 1 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null)
            echo "" > /dev/tty
            if (re:match '^[sS]' $answer) {
              ui:dim "Skipping story, moving to next..." > /dev/tty
              continue
            } else {
              set pending-ext-deps-report = (prd:get-external-deps-report $story-id)
              if (eq $pending-ext-deps-report "") {
                ui:dim "No report provided, skipping story..." > /dev/tty
                continue
              }
              ui:success "External deps report received" > /dev/tty
              prd:save-external-deps-report $story-id $pending-ext-deps-report
              echo "" > /dev/tty
              claude:propagate-external-deps $story-id $pending-ext-deps-report
              echo "" > /dev/tty
            }
          } catch { }
        }
      }

      # Mark validation as done for this iteration (checkpoint saved after branch creation)
      set validation-done = $true

      # NOW create branch (validation and ext deps passed)
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
    if (or (not (has-key $current-state started_at)) (not $current-state[started_at])) {
      set current-state[started_at] = (date -u '+%Y-%m-%dT%H:%M:%SZ')
    }
    state:write $current-state

    # Checkpoint: branch created (now only saved AFTER validation passes)
    var head-commit = ""
    try {
      set head-commit = (str:trim-space (git -C $project-root rev-parse --short HEAD 2>/dev/null | slurp))
    } catch _ { }
    state:save-checkpoint $story-id "branch_created" [&branch=$branch-name &commit=$head-commit]

    # For new stories, validation was done before branch creation - save checkpoint now
    if $validation-done {
      state:save-checkpoint $story-id "validation_complete" [&clarification=$pending-clarification]
    }

    # Verbose: show state transition
    if $config[verbose-mode] {
      ui:dim "VERBOSE: State transition -> in_progress"
      ui:dim "  story="$story-id" branch="$branch-name" attempts="$current-state[attempts]
    }

    git:ensure-on-branch $branch-name

    # Validation checkpoint (for resume/continue - skip if already done for new stories above)
    if (and (not $validation-done) (not (or (eq $skip-to-stage "claude") (eq $skip-to-stage "pr_flow")))) {
      # Capture all outputs into list and use last value (handles arity issues)
      var validate-results = [(claude:validate-story $story-id)]
      var validation = [&valid=$true &questions=""]
      if (> (count $validate-results) 0) {
        set validation = $validate-results[-1]
      }
      if (not $validation[valid]) {
        echo "" > /dev/tty

        # Handle auto-clarify flag - automatically proceed with assumptions
        if $config[auto-clarify] {
          ui:dim "Auto-clarify enabled, proceeding with reasonable assumptions..." > /dev/tty
          set pending-clarification = "Auto-clarify mode: Make reasonable assumptions based on the codebase context and existing patterns. If unsure, choose the simpler implementation."
        } else {
          ui:warn "Story "$story-id" needs clarification before implementation." > /dev/tty
          echo "" > /dev/tty
          echo "What would you like to do?" > /dev/tty
          echo "\e[33m  [s]kip\e[0m     - Move to the next story" > /dev/tty
          echo "\e[33m  [c]larify\e[0m  - Answer these questions (opens editor)" > /dev/tty
          echo "\e[33m  [a]uto\e[0m     - Let Ralph make reasonable assumptions" > /dev/tty
          echo "\e[33m  [q]uit\e[0m     - Stop and fix the story manually" > /dev/tty
          echo "" > /dev/tty
          echo "\e[33mChoice [s/c/a/q]:\e[0m " > /dev/tty
          try {
            var answer = (bash -c 'read -n 1 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null)
            echo "" > /dev/tty
            if (re:match '^[qQ]' $answer) {
              # Quit
              echo ""
              ui:status "Stopping. Clarify the story and run again."
              exit 0
            } elif (re:match '^[cC]' $answer) {
              # Open editor for clarification
              set pending-clarification = (prd:get-clarification $story-id $validation[questions])
              if (eq $pending-clarification "") {
                ui:dim "No clarification provided, skipping story..." > /dev/tty
                # Reset state so next iteration picks a new story
                set current-state[current_story] = $nil
                set current-state[branch] = $nil
                set current-state[status] = "idle"
                set current-state[attempts] = (num 0)
                state:write $current-state
                continue
              }
              ui:success "Clarification received, proceeding with implementation..." > /dev/tty
            } elif (re:match '^[aA]' $answer) {
              # Auto-proceed with reasonable assumptions
              ui:dim "Proceeding with reasonable assumptions..." > /dev/tty
              set pending-clarification = "Auto-proceed mode: Make reasonable assumptions based on the codebase context and existing patterns. If unsure, choose the simpler implementation."
            } else {
              # Default or 's' - skip story
              ui:dim "Skipping story, moving to next..." > /dev/tty
              # Reset state so next iteration picks a new story
              set current-state[current_story] = $nil
              set current-state[branch] = $nil
              set current-state[status] = "idle"
              set current-state[attempts] = (num 0)
              state:write $current-state

              # Verbose: show state transition
              if $config[verbose-mode] {
                ui:dim "VERBOSE: State transition -> idle (validation skip)"
              }
              continue
            }
          } catch { }
        }
      }

      # Checkpoint: validation complete
      state:save-checkpoint $story-id "validation_complete" [&clarification=$pending-clarification]
    }

    # Check for external dependencies (unless already done, have report, in feedback mode, or skipping to later stage)
    if (and (not $validation-done) (eq $pending-feedback "") (eq $pending-ext-deps-report "") (not (or (eq $skip-to-stage "claude") (eq $skip-to-stage "pr_flow")))) {
      if (prd:has-external-deps $story-id) {
        echo "" > /dev/tty
        ui:warn "Story "$story-id" has external dependencies:" > /dev/tty
        echo "" > /dev/tty
        var deps = [(prd:get-external-deps $story-id)]
        for dep $deps {
          var parts = [(str:split "|" $dep)]
          var name = $parts[0]
          var desc = ""
          if (> (count $parts) 1) {
            set desc = $parts[1]
          }
          ui:dim "  • "$name": "$desc > /dev/tty
        }
        echo "" > /dev/tty
        echo "Claude needs to know how these were implemented." > /dev/tty
        echo "\e[33m  [r]eport\e[0m - Describe the implementation (opens editor)" > /dev/tty
        echo "\e[33m  [s]kip\e[0m   - Skip this story for now" > /dev/tty
        echo "" > /dev/tty
        echo "\e[33mChoice [r/s]:\e[0m " > /dev/tty
        try {
          var answer = (bash -c 'read -n 1 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null)
          echo "" > /dev/tty
          if (re:match '^[sS]' $answer) {
            ui:dim "Skipping story, moving to next..." > /dev/tty
            # Reset state so next iteration picks a new story
            set current-state[current_story] = $nil
            set current-state[branch] = $nil
            set current-state[status] = "idle"
            set current-state[attempts] = (num 0)
            state:write $current-state
            continue
          } else {
            # Default to [r]eport
            set pending-ext-deps-report = (prd:get-external-deps-report $story-id)
            if (eq $pending-ext-deps-report "") {
              ui:dim "No report provided, skipping story..." > /dev/tty
              # Reset state so next iteration picks a new story
              set current-state[current_story] = $nil
              set current-state[branch] = $nil
              set current-state[status] = "idle"
              set current-state[attempts] = (num 0)
              state:write $current-state
              continue
            }
            ui:success "External deps report received" > /dev/tty

            # Save report to PRD
            prd:save-external-deps-report $story-id $pending-ext-deps-report

            # Propagate to descendant stories
            echo "" > /dev/tty
            claude:propagate-external-deps $story-id $pending-ext-deps-report
            echo "" > /dev/tty
          }
        } catch { }
      }
    }

    # Initialize variables needed by later code
    var signals = [&complete=$false &blocked=$false &all_complete=$false]
    var was-feedback-refinement = $false
    var claude-duration = 0
    var claude-tokens = [&input=(num 0) &output=(num 0)]
    var story-title = (prd:get-story-title $story-id)

    # Skip Claude execution if resuming to PR flow
    if (eq $skip-to-stage "pr_flow") {
      ui:status "Skipping to PR flow (checkpoint resume)..."
      set signals[complete] = $true  # We completed Claude in a previous run
    } else {
      # Check for previous failure context (smart retry)
      if (and (eq $pending-failure-context "") (> $current-state[attempts] 1)) {
        var failure-info = (state:get-failure-info)
        if (and $failure-info[error] (> $failure-info[count] 0)) {
          set pending-failure-context = $failure-info[error]

          # Auto-escalate to user feedback after 2 failures with same error
          if (>= $failure-info[count] 2) {
            echo "" > /dev/tty
            ui:warn "This story has failed "(to-string $failure-info[count])" times with the same error:" > /dev/tty
            ui:dim "  "$failure-info[error] > /dev/tty
            echo "" > /dev/tty
            echo "\e[33m[f]eedback\e[0m - Provide guidance to help Claude succeed" > /dev/tty
            echo "\e[33m[r]etry\e[0m    - Try again with failure context" > /dev/tty
            echo "\e[33m[s]kip\e[0m     - Skip this story for now" > /dev/tty
            echo "" > /dev/tty
            echo "\e[33mChoice [f/r/s]:\e[0m " > /dev/tty
            try {
              var answer = (bash -c 'read -n 1 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null)
              echo "" > /dev/tty
              if (re:match '^[fF]' $answer) {
                # Open editor for user feedback
                var tmp = (mktemp)
                echo "# Provide guidance to help Claude complete this story" > $tmp
                echo "# The previous attempts failed with:" >> $tmp
                echo "#   "$failure-info[error] >> $tmp
                echo "#" >> $tmp
                echo "# Describe what Claude should do differently:" >> $tmp
                echo "" >> $tmp

                var editor = "vim"
                if (has-env EDITOR) { set editor = $E:EDITOR }
                try {
                  (external $editor) $tmp </dev/tty >/dev/tty 2>/dev/tty
                } catch _ { }

                set pending-feedback = (grep -v '^#' $tmp 2>/dev/null | slurp)
                rm -f $tmp
                if (not (eq (str:trim-space $pending-feedback) "")) {
                  ui:success "Feedback received, proceeding with guidance..." > /dev/tty
                  state:clear-failure
                  set pending-failure-context = ""
                }
              } elif (re:match '^[sS]' $answer) {
                ui:dim "Skipping story..." > /dev/tty
                set current-state[current_story] = $nil
                set current-state[branch] = $nil
                set current-state[status] = "idle"
                set current-state[attempts] = (num 0)
                state:write $current-state
                state:clear-failure
                continue
              }
              # Default to retry with failure context
            } catch _ { }
          }
        }
      }

      # Prepare Claude prompt (with any pending feedback, clarification, or external deps report)
      var prep = (claude:prepare $story-id $branch-name $current-state[attempts] $current-iteration $pending-feedback &clarification=$pending-clarification &external_deps_report=$pending-ext-deps-report &previous_failure=$pending-failure-context)
      var prompt-file = $prep[prompt-file]
      var output-file = $prep[output-file]
      set story-title = $prep[story-title]
      var claude-config = (claude:get-config)

      # Verbose: show full prompt
      if $config[verbose-mode] {
        ui:divider "VERBOSE: Full Prompt"
        cat $prompt-file
        ui:divider-end
        echo ""
      }

      # Clear feedback/clarification/ext-deps-report/failure-context after using it, track mode for display
      var mode-label = "attempt "$current-state[attempts]
      if (not (eq $pending-feedback "")) {
        set mode-label = "feedback refinement"
        set was-feedback-refinement = $true
        set pending-feedback = ""  # Clear after use
      } elif (not (eq $pending-clarification "")) {
        set mode-label = "with clarification"
        set pending-clarification = ""  # Clear after use
      } elif (not (eq $pending-ext-deps-report "")) {
        set mode-label = "with external deps"
        set pending-ext-deps-report = ""  # Clear after use
      } elif (not (eq $pending-failure-context "")) {
        set mode-label = "retry with failure context"
        set pending-failure-context = ""  # Clear after use
      }
      ui:status "Running Claude ("$mode-label")..."
      ui:dim "  Story:  "$story-id
      ui:dim "  Title:  "$story-title
      ui:dim "  Branch: "$branch-name
      ui:dim "  Output: "$output-file
      echo ""

      ui:status "Invoking Claude CLI..."
      ui:dim "  This may take several minutes. Claude is working autonomously."
      if $claude-config[quiet-mode] {
        ui:dim "  Quiet mode: output captured to file only."
      } else {
        ui:dim "  Streaming mode: real-time output."
      }
      ui:dim "  Waiting for completion signal..."
      echo ""

      ui:divider "Claude Working"

      # Checkpoint: claude started
      state:save-checkpoint $story-id "claude_started" [&attempt=$current-state[attempts]]

      # Run streaming pipeline at TOP LEVEL (not in a function) - this is critical for streaming to work
      cd $claude-config[project-root]
      var claude-start = (date +%s)

      try {
        if $claude-config[quiet-mode] {
          timeout $claude-config[timeout] bash -c 'claude --dangerously-skip-permissions --print < "$1"' _ $prompt-file > $output-file 2>&1
        } else {
          # jq filters from https://www.aihero.dev/heres-how-to-stream-claude-code-with-afk-ralph
          var stream-text = 'select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
          var final-result = 'select(.type == "result").result // empty'

          # Streaming pipeline - must run at top level, not in a function
          try {
            timeout $claude-config[timeout] claude --dangerously-skip-permissions --verbose --print --output-format stream-json < $prompt-file 2>&1 | grep --line-buffered '^{' | tee $output-file | jq --unbuffered -rj $stream-text 2>/dev/null
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
        set claude-duration = (- $claude-end $claude-start)
        ui:divider-end
        ui:success "Claude execution completed in "$claude-duration"s"
      } catch e {
        var claude-end = (date +%s)
        set claude-duration = (- $claude-end $claude-start)
        ui:divider-end
        if (>= $claude-duration $claude-config[timeout]) {
          ui:warn "Claude timed out after "$claude-config[timeout]"s"
          ui:dim "The story might be too complex. Try:"
          ui:dim "  • Breaking it into smaller stories"
          ui:dim "  • Increasing timeout with --timeout <seconds>"
          ui:dim "  • Running ./ralph.elv --resume to continue"
          # Track failure for smart retry
          var fc = (state:record-failure "Timeout after "$claude-config[timeout]"s - story may be too complex")
          if (>= $fc 2) {
            ui:warn "This is failure #"(to-string $fc)" - consider providing feedback on next run"
          }
        } else {
          ui:warn "Claude encountered an issue"
          ui:dim "Error: "(to-string $e[reason])
          ui:dim "Run ./ralph.elv --resume to try again"
          # Track failure for smart retry
          var fc = (state:record-failure "Claude error: "(to-string $e[reason]))
          if (>= $fc 2) {
            ui:warn "This is failure #"(to-string $fc)" - consider providing feedback on next run"
          }
        }
      } finally {
        rm -f $prompt-file
        rm -f $output-file".result" 2>/dev/null
      }

      # Format code files
      echo ""
      format:go-files $project-root
      echo ""

      # Verbose: show raw Claude output
      if $config[verbose-mode] {
        ui:divider "VERBOSE: Raw Claude Output"
        try {
          cat $output-file
        } catch _ {
          ui:dim "(output file empty or not readable)"
        }
        ui:divider-end
        echo ""
      }

      # Extract tokens before cleanup (for metrics)
      set claude-tokens = (metrics:extract-tokens-from-output $output-file)

      # Check signals
      ui:status "Checking for completion signals..."
      set signals = (claude:check-signals $output-file $story-id)
      if $signals[complete] {
        ui:dim "  Signal: complete"
      } elif $signals[blocked] {
        ui:dim "  Signal: blocked"
        if (not (eq $signals[message] "")) {
          ui:dim "  Reason: "$signals[message]
        }
      } elif $signals[all_complete] {
        ui:dim "  Signal: all_complete"
      } else {
        ui:dim "  No completion signal found (story still in progress)"
      }
      claude:cleanup $output-file
      echo ""

      # Checkpoint: claude complete (if signal found)
      if $signals[complete] {
        var complete-commit = ""
        try {
          set complete-commit = (str:trim-space (git -C $project-root rev-parse --short HEAD 2>/dev/null | slurp))
        } catch _ { }
        state:save-checkpoint $story-id "claude_complete" [&signal="complete" &commit=$complete-commit]
      }
    }
    # End of else block for skip-to-stage check

    ui:status "Updating state based on outcome..."

    if $signals[complete] {
      echo ""
      ui:success "Story "$story-id" completed!"
      # Clear failure tracking on success
      state:clear-failure
      set pending-failure-context = ""
      if $config[notify-enabled] {
        ui:notify "Ralph" "Story "$story-id" completed!"
      }

      # Record metrics
      ui:dim "  Recording metrics..."
      metrics:record $story-id $claude-duration $claude-tokens[input] $claude-tokens[output]
      ui:dim "  Duration: "$claude-duration"s, Tokens: "(+ $claude-tokens[input] $claude-tokens[output])

      # Extract learnings before PR flow
      echo ""
      claude:extract-learnings $story-id $branch-name

      # Run PR flow (may request feedback)
      # Pass pr_url from state to skip PR prompt if already exists
      echo ""
      var story-title = (prd:get-story-title $story-id)
      var state-pr-url = (if (and (has-key $current-state pr_url) $current-state[pr_url]) { put $current-state[pr_url] } else { put "" })
      var pr-flow-result = (pr:run-flow $story-id $branch-name $story-title $current-iteration &state-pr-url=$state-pr-url &feedback-pending=$was-feedback-refinement)
      var pr-result = $pr-flow-result[result]
      var pr-url = $pr-flow-result[pr_url]

      # Checkpoint: PR created (if we have a URL and it's not merged yet)
      if (and (not (eq $pr-url "")) (not (eq $pr-result "merged"))) {
        state:save-checkpoint $story-id "pr_created" [&pr_url=$pr-url]
      }

      # Handle feedback loop - re-run Claude with feedback
      if (eq $pr-result "feedback") {
        var fb = (pr:get-stored-feedback)
        if (not (eq $fb "")) {
          echo ""
          ui:banner "Feedback Loop - Re-running Claude"
          ui:dim "Feedback: "$fb
          echo ""

          # Store feedback for next iteration
          set pending-feedback = $fb

          # Re-set state to in_progress with current story, preserve pr_url
          set current-state[current_story] = $story-id
          set current-state[branch] = $branch-name
          set current-state[pr_url] = $pr-url
          set current-state[status] = "in_progress"
          set current-state[attempts] = (+ $current-state[attempts] 1)
          state:write $current-state

          # Verbose: show state transition
          if $config[verbose-mode] {
            ui:dim "VERBOSE: State transition -> in_progress (feedback loop)"
            ui:dim "  pr_url="$pr-url" attempts="$current-state[attempts]
          }

          # Continue to re-run Claude with feedback on next iteration
          ui:dim "Feedback received. Re-running story with feedback..."
          continue
        }
      }

      # Reset state after PR handled
      ui:dim "  Resetting state to idle..."
      set current-state[current_story] = $nil
      set current-state[branch] = $nil
      set current-state[pr_url] = $nil
      set current-state[status] = "idle"
      set current-state[started_at] = $nil
      set current-state[attempts] = (num 0)
      set current-state[error] = $nil
      state:write $current-state
      state:clear-checkpoints $story-id
      ui:dim "  State saved."

      # Verbose: show state transition
      if $config[verbose-mode] {
        ui:dim "VERBOSE: State transition -> idle (story complete)"
      }

      if (eq $pr-result "merged") {
        # Sync base branch only if merged
        echo ""
        git:sync-base-branch
      }

      # Check for one-shot or single-story mode - exit cleanly after completion
      if (or $config[one-shot-mode] $single-story-mode) {
        echo ""
        ui:box "Story complete!" "success"
        ui:dim "Exiting after one story (--one or --story mode)."
        exit 0
      }

      # Pause before next story
      echo ""
      ui:status "Story "$story-id" done!"
      echo ""
      echo "Ready for the next story?" > /dev/tty
      echo "\e[33m  [c]ontinue\e[0m - Start the next story" > /dev/tty
      echo "\e[33m  [s]top\e[0m     - Take a break (you can resume later)" > /dev/tty
      echo "" > /dev/tty
      echo "\e[2mAuto-continues in 120s...\e[0m" > /dev/tty
      echo "\e[33mChoice [c/s]:\e[0m " > /dev/tty
      try {
        var answer = (bash -c 'read -t 120 -n 1 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null)
        if (re:match '^[sS]' $answer) {
          echo ""
          ui:status "Taking a break. Run ./ralph.elv to continue."
          exit 0
        }
      } catch {
        ui:dim "(Timeout - continuing automatically)"
      }
      ui:dim "Continuing to next story..."

    } elif $signals[blocked] {
      echo ""
      ui:warn "Story "$story-id" hit a blocker"
      if $config[notify-enabled] {
        ui:notify "Ralph" "Story "$story-id" needs attention"
      }
      ui:dim "Claude couldn't complete this story. Check the output above for details."
      ui:dim "You can retry with: ./ralph.elv --retry-clean "$story-id
      ui:dim "Clearing state to try the next story..."
      # Track failure for smart retry
      var fc = (state:record-failure "Story blocked - Claude reported blocked status")
      if (>= $fc 2) {
        ui:warn "This is failure #"(to-string $fc)" on this story"
      }
      set current-state[status] = "blocked"
      set current-state[current_story] = $nil
      set current-state[branch] = $nil
      set current-state[started_at] = $nil
      set current-state[attempts] = (num 0)
      state:write $current-state
      state:clear-checkpoints $story-id
      ui:dim "  State saved."

      # Verbose: show state transition
      if $config[verbose-mode] {
        ui:dim "VERBOSE: State transition -> blocked"
      }

    } else {
      ui:dim "  Story still in progress..."
    }

    if $signals[all_complete] {
      echo ""
      ui:box "All done! Ready to ship "$active-version "success"
      if $config[notify-enabled] {
        ui:notify "Ralph" "All stories complete!"
      }
      metrics:show-celebration
      ui:dim "Total iterations: "$current-iteration

      var release-result = (release:run-full-flow $active-version &skip-release=$config[skip-release] &auto-release=$config[auto-release] &notify-enabled=$config[notify-enabled])

      if (and (has-key $release-result error) $release-result[error]) {
        exit 1
      }
      exit 0
    }

    sleep 2
}

echo ""
ui:box "MAX ITERATIONS REACHED" "warn"
ui:dim "Iterations: "$config[max-iterations]
ui:dim "Run again to continue."
exit 0
