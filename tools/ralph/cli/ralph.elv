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
state:init $state-file
git:init $project-root $config[base-branch]
claude:init $project-root $script-dir $prompt-template $config[claude-timeout] $config[quiet-mode] $config[max-iterations]
pr:init $project-root $config[base-branch] $config[auto-pr] $config[auto-merge]
metrics:init $metrics-file
release:init $project-root $config[base-branch] "main" $config[claude-timeout]

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
  ui:box "PLAN MODE - Read-Only" "info"
  echo ""

  # Get next story (or current)
  var current-state = (state:read)
  var story-id = ""

  if $current-state[current_story] {
    set story-id = $current-state[current_story]
    ui:status "Planning for current story: "$story-id
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
    ui:status "Planning for next story: "$story-id
  }

  var story-title = (prd:get-story-title $story-id)
  ui:dim "  Title: "$story-title
  echo ""

  # Generate plan prompt
  var prompt-file = (claude:prepare-plan-prompt $story-id)

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
  echo "\e[33mContinue anyway? [y/N]\e[0m"
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
if (and $config[no-validate] $config[auto-pr] $config[auto-merge]) {
  ui:warn "YOLO mode: No validation, auto-PR, auto-merge"
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
  var story-id = $config[retry-clean-story]
  ui:status "Retry clean: "$story-id

  # Get branch name for story
  var branch-name = ""
  try {
    set branch-name = (prd:get-branch-name $story-id)
  } catch _ { }

  # Delete local branch if exists
  if (not (eq $branch-name "")) {
    ui:dim "  Deleting local branch: "$branch-name
    try {
      git -C $project-root branch -D $branch-name 2>/dev/null
    } catch _ { }

    # Delete remote branch if exists
    ui:dim "  Deleting remote branch: "$branch-name
    try {
      git -C $project-root push origin --delete $branch-name 2>/dev/null
    } catch _ { }
  }

  # Reset story in prd.json
  ui:dim "  Resetting story state in PRD"
  prd:reset-story $story-id

  # Clear state.json
  ui:dim "  Clearing Ralph state"
  state:reset

  ui:success "Story "$story-id" reset for fresh retry"
  ui:dim "Run ./ralph.elv to start fresh"
  exit 0
}

# Handle skip mode
if (not (eq $config[skip-story-id] "")) {
  ui:status "Skipping story: "$config[skip-story-id]
  ui:dim "  Reason: "$config[skip-reason]
  prd:skip-story $config[skip-story-id] $config[skip-reason]

  # Log to activity
  var today = (date '+%Y-%m-%d')
  var timestamp = (date '+%Y-%m-%d %H:%M')
  var activity-file = (path:join $project-root "logs" "activity" "trinity" $today".md")
  var story-title = (prd:get-story-title $config[skip-story-id])
  var story-info = (prd:get-story-info $config[skip-story-id])
  var info-parts = [(str:split "\t" $story-info)]
  var phase = $info-parts[0]
  var epic = $info-parts[1]

  echo "" >> $activity-file
  echo "## "$config[skip-story-id]": "$story-title >> $activity-file
  echo "" >> $activity-file
  echo "**Phase:** "$phase" | **Epic:** "$epic" | **Version:** "$active-version >> $activity-file
  echo "**Skipped:** "$timestamp >> $activity-file
  echo "" >> $activity-file
  echo "### Reason" >> $activity-file
  echo $config[skip-reason] >> $activity-file
  echo "" >> $activity-file
  echo "---" >> $activity-file

  ui:success "Story skipped. Dependents can now proceed."
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

  # Skip release flow if requested
  if $config[skip-release] {
    ui:dim "Release skipped (--skip-release)"
    echo "<promise>COMPLETE</promise>"
    exit 0
  }

  # Check if already released
  if (prd:is-version-released $active-version) {
    ui:success $active-version" already released!"
    echo "<promise>COMPLETE</promise>"
    exit 0
  }

  # Run release flow
  var release-tag = $config[release-tag]
  if (eq $release-tag "") {
    set release-tag = $active-version
  }

  while $true {
    # Show summary
    release:show-summary $active-version

    # Human gate (unless --auto-release)
    if $config[auto-release] {
      ui:dim "Auto-release enabled, proceeding..."
    } else {
      var approval = (release:prompt-approval $release-tag)

      if (eq $approval[action] "cancel") {
        ui:dim "Release cancelled. Run again when ready."
        exit 0
      }

      if (eq $approval[action] "feedback") {
        # Run hotfix directly (not a PRD story)
        ui:status "Running hotfix for release feedback..."
        var hotfix-result = (release:run-hotfix $active-version $approval[feedback])
        if $hotfix-result[success] {
          ui:success "Hotfix merged to dev"
          echo ""
          ui:box "RELEASE GATE - Try Again" "info"
          # Loop back to release prompt
          continue
        } else {
          ui:error "Hotfix failed: "$hotfix-result[error]
          exit 1
        }
      }

      # Update tag if edited
      set release-tag = $approval[tag]
    }

    # Execute release
    var result = (release:run $active-version $release-tag)

    if $result[success] {
      echo ""
      ui:box "RELEASED: "$active-version" ("$result[tag]")" "success"
      if $config[notify-enabled] {
        ui:notify "Ralph" "Released "$active-version" as "$result[tag]
      }
    } else {
      ui:error "Release failed: "$result[error]
      exit 1
    }

    break
  }

  echo "<promise>COMPLETE</promise>"
  exit 0
}

# Check for passed-but-not-merged stories (need to merge before continuing)
var unmerged = [(prd:get-unmerged-passed)]
if (> (count $unmerged) 0) {
  ui:warn "Found "(count $unmerged)" story(s) passed but not merged:"
  for sid $unmerged {
    var story-title = (prd:get-story-title $sid)
    var branch = (prd:get-story-branch $sid)
    ui:dim "  "$sid": "$story-title" (branch: "$branch")"
  }
  echo ""

  for sid $unmerged {
    var story-title = (prd:get-story-title $sid)
    var branch = (prd:get-story-branch $sid)

    # Check if branch still exists
    try {
      git -C $project-root rev-parse --verify "refs/heads/"$branch > /dev/null 2>&1
    } catch {
      # Branch doesn't exist locally, try remote
      try {
        git -C $project-root rev-parse --verify "refs/remotes/origin/"$branch > /dev/null 2>&1
      } catch {
        ui:dim "Branch "$branch" not found, skipping "$sid
        continue
      }
    }

    # Run PR flow for this story
    ui:status "Handling unmerged story: "$sid
    var _ = (pr:run-flow $sid $branch $story-title 0)
    echo ""
  }
}

# Main loop
var current-iteration = 0
var resume-mode = $config[resume-mode]
var pending-feedback = ""  # Feedback from PR review to pass to next Claude run

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
          break
        } else {
          # Stories exist but are blocked
          echo ""
          ui:box "BLOCKED - WAITING ON DEPENDENCIES" "warn"
          echo ""

          # Show unmerged PRs
          var unmerged = [(prd:get-unmerged-passed)]
          if (> (count $unmerged) 0) {
            echo "Unmerged PRs:"
            for sid $unmerged {
              var pr-url = (prd:get-pr-url $sid)
              var title = (prd:get-story-title $sid)
              if (not (eq $pr-url "")) {
                ui:dim "  • "$sid" ("$title"): "$pr-url
              } else {
                var branch = (prd:get-story-branch $sid)
                ui:dim "  • "$sid" ("$title") - no PR yet (branch: "$branch")"
              }
            }
            echo ""
          }

          # Show blocked stories
          var blocked = [(prd:get-blocked-stories)]
          if (> (count $blocked) 0) {
            echo "Pending stories blocked by unmerged work:"
            for info $blocked {
              var title = (prd:get-story-title $info[story])
              ui:dim "  • "$info[story]" ("$title") → waiting on "$info[blocked_by]
            }
            echo ""
          }

          ui:dim "Run ralph to pick up where you left off."
          break
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

    # Validate story (unless --no-validate or feedback refinement)
    if (and (not $config[no-validate]) (eq $pending-feedback "")) {
      # Capture all outputs into list and use last value (handles arity issues)
      var validate-results = [(claude:validate-story $story-id)]
      var is-valid = $true
      if (> (count $validate-results) 0) {
        set is-valid = $validate-results[-1]
      }
      if (not $is-valid) {
        echo "" > /dev/tty
        ui:warn "Story "$story-id" needs clarification before implementation." > /dev/tty
        echo "\e[33mSkip this story and continue? [Y/n]\e[0m" > /dev/tty
        try {
          var answer = (bash -c 'read -n 1 ans 2>/dev/null; echo "$ans"' </dev/tty 2>/dev/null)
          if (re:match '^[nN]' $answer) {
            echo ""
            ui:status "Stopping. Clarify the story and run again."
            exit 0
          }
        } catch { }
        echo ""
        ui:dim "Skipping story, will try next..."
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
    }

    # Prepare Claude prompt (with any pending feedback)
    var prep = (claude:prepare $story-id $branch-name $current-state[attempts] $current-iteration $pending-feedback)
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

    # Clear feedback after using it, track if this was a feedback refinement
    var mode-label = "attempt "$current-state[attempts]
    var was-feedback-refinement = $false
    if (not (eq $pending-feedback "")) {
      set mode-label = "feedback refinement"
      set was-feedback-refinement = $true
      set pending-feedback = ""  # Clear after use
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

      # Skip release flow if requested
      if $config[skip-release] {
        ui:dim "Release skipped (--skip-release)"
        exit 0
      }

      # Check if already released
      if (prd:is-version-released $active-version) {
        ui:success $active-version" already released!"
        exit 0
      }

      # Run release flow
      var release-tag = $config[release-tag]
      if (eq $release-tag "") {
        set release-tag = $active-version
      }

      while $true {
        # Show summary
        release:show-summary $active-version

        # Human gate (unless --auto-release)
        if $config[auto-release] {
          ui:dim "Auto-release enabled, proceeding..."
        } else {
          var approval = (release:prompt-approval $release-tag)

          if (eq $approval[action] "cancel") {
            ui:dim "Release cancelled. Run again when ready."
            exit 0
          }

          if (eq $approval[action] "feedback") {
            # Run hotfix directly (not a PRD story)
            ui:status "Running hotfix for release feedback..."
            var hotfix-result = (release:run-hotfix $active-version $approval[feedback])
            if $hotfix-result[success] {
              ui:success "Hotfix merged to dev"
              echo ""
              ui:box "RELEASE GATE - Try Again" "info"
              # Loop back to release prompt
              continue
            } else {
              ui:error "Hotfix failed: "$hotfix-result[error]
              exit 1
            }
          }

          # Update tag if edited
          set release-tag = $approval[tag]
        }

        # Execute release
        var result = (release:run $active-version $release-tag)

        if $result[success] {
          echo ""
          ui:box "RELEASED: "$active-version" ("$result[tag]")" "success"
          if $config[notify-enabled] {
            ui:notify "Ralph" "Released "$active-version" as "$result[tag]
          }
        } else {
          ui:error "Release failed: "$result[error]
          exit 1
        }

        break
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
