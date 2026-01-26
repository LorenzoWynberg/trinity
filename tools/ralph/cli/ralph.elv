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
use ./lib/learnings
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
    ui:error "Version "$config[target-version]" not found or has no stories"
  } else {
    ui:success "All versions complete!"
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
learnings:init $project-root &base=$config[base-branch]

# Check if learnings need compaction (monthly maintenance)
learnings:check-and-compact

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
  ui:box "ALL STORIES COMPLETE - READY FOR RELEASE" "success"

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
          # Stories exist but are blocked
          prd:show-blocked-state
          exit 0
        }
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
    if (or (not (has-key $current-state started_at)) (not $current-state[started_at])) {
      set current-state[started_at] = (date -u '+%Y-%m-%dT%H:%M:%SZ')
    }
    state:write $current-state

    # Verbose: show state transition
    if $config[verbose-mode] {
      ui:dim "VERBOSE: State transition -> in_progress"
      ui:dim "  story="$story-id" branch="$branch-name" attempts="$current-state[attempts]
    }

    git:ensure-on-branch $branch-name

    # Validate story (unless feedback refinement or already have clarification)
    if (and (eq $pending-feedback "") (eq $pending-clarification "")) {
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
          echo "\e[33m[y]es skip / [n]o stop / [c]larify / [a]uto-proceed\e[0m" > /dev/tty
          try {
            var answer = (bash -c 'read -n 1 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null)
            echo "" > /dev/tty
            if (re:match '^[nN]' $answer) {
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
              # Default Y - skip story
              ui:dim "Skipping story, will try next..." > /dev/tty
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
    }

    # Check for external dependencies (unless already have report or in feedback mode)
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
        echo "\e[33m[r]eport / [n]o skip\e[0m" > /dev/tty
        try {
          var answer = (bash -c 'read -n 1 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null)
          echo "" > /dev/tty
          if (re:match '^[nN]' $answer) {
            ui:dim "Skipping story, will try next..." > /dev/tty
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

    # Prepare Claude prompt (with any pending feedback, clarification, or external deps report)
    var prep = (claude:prepare $story-id $branch-name $current-state[attempts] $current-iteration $pending-feedback &clarification=$pending-clarification &external_deps_report=$pending-ext-deps-report)
    var prompt-file = $prep[prompt-file]
    var output-file = $prep[output-file]
    var story-title = $prep[story-title]
    var claude-config = (claude:get-config)

    # Verbose: show full prompt
    if $config[verbose-mode] {
      ui:divider "VERBOSE: Full Prompt"
      cat $prompt-file
      ui:divider-end
      echo ""
    }

    # Clear feedback/clarification/ext-deps-report after using it, track mode for display
    var mode-label = "attempt "$current-state[attempts]
    var was-feedback-refinement = $false
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

    # Run streaming pipeline at TOP LEVEL (not in a function) - this is critical for streaming to work
    cd $claude-config[project-root]
    var claude-start = (date +%s)
    var claude-duration = 0
    var claude-tokens = [&input=(num 0) &output=(num 0)]

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
        ui:error "Claude execution TIMED OUT after "$claude-config[timeout]"s"
      } else {
        ui:error "Claude execution error: "(to-string $e[reason])
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
    var signals = (claude:check-signals $output-file $story-id)
    if $signals[complete] {
      ui:dim "  Found: <story-complete>"
    } elif $signals[blocked] {
      ui:dim "  Found: <story-blocked>"
    } elif $signals[all_complete] {
      ui:dim "  Found: <promise>COMPLETE</promise>"
    } else {
      ui:dim "  No completion signal found (story still in progress)"
    }
    claude:cleanup $output-file
    echo ""

    ui:status "Updating state based on outcome..."

    if $signals[complete] {
      echo ""
      ui:success "Story "$story-id" completed!"
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

      # Pause before next story
      echo ""
      ui:status "Story "$story-id" done. Continue to next story?"
      echo "\e[33mStop loop? [y/n]\e[0m \e[2m(continues in 120s)\e[0m"
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
      if $config[notify-enabled] {
        ui:notify "Ralph" "Story "$story-id" BLOCKED!"
      }
      ui:dim "  Clearing story state..."
      set current-state[status] = "blocked"
      set current-state[current_story] = $nil
      set current-state[branch] = $nil
      set current-state[started_at] = $nil
      set current-state[attempts] = (num 0)
      state:write $current-state
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
      ui:box "ALL STORIES COMPLETE - READY FOR RELEASE" "success"
      if $config[notify-enabled] {
        ui:notify "Ralph" "All stories complete!"
      }
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
