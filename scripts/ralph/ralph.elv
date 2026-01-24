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
    pr:run-flow $sid $branch $story-title 0
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

    # Validate story (unless --no-validate or feedback refinement)
    if (and (not $config[no-validate]) (eq $pending-feedback "")) {
      if (not (claude:validate-story $story-id)) {
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
        continue
      }
    }

    # Prepare Claude prompt (with any pending feedback)
    var prep = (claude:prepare $story-id $branch-name $current-state[attempts] $current-iteration $pending-feedback)
    var prompt-file = $prep[prompt-file]
    var output-file = $prep[output-file]
    var story-title = $prep[story-title]
    var claude-config = (claude:get-config)

    # Clear feedback after using it
    var mode-label = "attempt "$current-state[attempts]
    if (not (eq $pending-feedback "")) {
      set mode-label = "feedback refinement"
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
      var claude-duration = (- $claude-end $claude-start)
      ui:divider-end
      ui:success "Claude execution completed in "$claude-duration"s"
    } catch e {
      var claude-end = (date +%s)
      var claude-duration = (- $claude-end $claude-start)
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

      # Extract learnings before PR flow
      echo ""
      claude:extract-learnings $story-id $branch-name

      # Run PR flow (may request feedback)
      # Pass pr_url from state to skip PR prompt if already exists
      echo ""
      var story-title = (prd:get-story-title $story-id)
      var state-pr-url = (if $current-state[pr_url] { put $current-state[pr_url] } else { put "" })
      var pr-flow-result = (pr:run-flow $story-id $branch-name $story-title $current-iteration &state-pr-url=$state-pr-url)
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
