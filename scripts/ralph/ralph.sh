#!/usr/bin/env bash
# Ralph - Autonomous Development Loop for Trinity v0.1
# Main orchestration script

set -euo pipefail

# Get script directory and paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source library modules (before setting paths, as modules declare their own vars)
source "$SCRIPT_DIR/lib/ui.sh"
source "$SCRIPT_DIR/lib/cli.sh"
source "$SCRIPT_DIR/lib/state.sh"
source "$SCRIPT_DIR/lib/git.sh"
source "$SCRIPT_DIR/lib/prd.sh"
source "$SCRIPT_DIR/lib/activity.sh"
source "$SCRIPT_DIR/lib/claude.sh"
source "$SCRIPT_DIR/lib/pr.sh"

# File paths (after sourcing modules)
RALPH_PROMPT_FILE="$SCRIPT_DIR/prompt.md"
RALPH_PRD_FILE="$SCRIPT_DIR/prd.json"
RALPH_PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
RALPH_STATE_FILE="$SCRIPT_DIR/state.json"

# Parse arguments and validate
cli_parse_args "$@"
cli_check_dependencies
cli_check_files "$RALPH_PROMPT_FILE" "$RALPH_PRD_FILE" "$RALPH_PROGRESS_FILE"

# Load prompt template
PROMPT_TEMPLATE=$(cat "$RALPH_PROMPT_FILE")

# Initialize modules
state_init "$RALPH_STATE_FILE"
git_init "$PROJECT_ROOT" "$BASE_BRANCH"
prd_init "$RALPH_PRD_FILE"
activity_init "$PROJECT_ROOT"
claude_init "$PROJECT_ROOT" "$PROMPT_TEMPLATE" "$CLAUDE_TIMEOUT" "$QUIET_MODE" "$MAX_ITERATIONS"
pr_init "$PROJECT_ROOT" "$BASE_BRANCH" "$AUTO_PR" "$AUTO_MERGE"

# Print banner
echo ""
ui_box "RALPH - Autonomous Development Loop" "info"
echo ""
ui_dim "Project:        $PROJECT_ROOT"
ui_dim "Base branch:    $BASE_BRANCH"
ui_dim "Max iterations: $MAX_ITERATIONS"
if [[ "$QUIET_MODE" == "true" ]]; then
  ui_dim "Mode:           quiet (Claude output hidden)"
fi
echo ""

# Handle reset mode
if [[ "$RESET_MODE" == "true" ]]; then
  ui_status "Resetting state..."
  state_reset
  ui_success "State reset complete."
  echo ""
fi

# Read current state
ui_dim "Current state:"
ui_dim "  Status:   $(state_get status)"
ui_dim "  Story:    $(state_get current_story || echo '(none)')"
ui_dim "  Branch:   $(state_get branch || echo '(none)')"
ui_dim "  Attempts: $(state_get attempts)"
echo ""

# Check if all stories are already complete
if prd_all_stories_complete; then
  ui_success "All stories are complete!"
  echo "<promise>COMPLETE</promise>"
  exit 0
fi

# Check for passed-but-not-merged stories (need to merge before continuing)
UNMERGED_OUTPUT=$(prd_get_unmerged_passed)
if [[ -n "$UNMERGED_OUTPUT" ]]; then
  # Count stories
  UNMERGED_COUNT=$(echo "$UNMERGED_OUTPUT" | wc -l | tr -d ' ')
  ui_warn "Found $UNMERGED_COUNT story(s) passed but not merged:"

  # Display list (pipe is fine here, no user input needed)
  echo "$UNMERGED_OUTPUT" | while IFS= read -r sid; do
    [[ -z "$sid" ]] && continue
    story_title=$(prd_get_story_title "$sid")
    branch=$(prd_get_story_branch "$sid")
    ui_dim "  $sid: $story_title (branch: $branch)"
  done
  echo ""

  # Process each - use here-string to avoid subshell (preserves TTY access)
  while IFS= read -r sid; do
    [[ -z "$sid" ]] && continue
    story_title=$(prd_get_story_title "$sid")
    branch=$(prd_get_story_branch "$sid")

    # Check if branch still exists
    if ! git_branch_exists "$branch"; then
      ui_dim "Branch $branch not found, skipping $sid"
      continue
    fi

    # Run PR flow for this story
    ui_status "Handling unmerged story: $sid"
    pr_run_flow "$sid" "$branch" "$story_title" 0
    echo ""
  done <<< "$UNMERGED_OUTPUT"
fi

# Main loop
CURRENT_ITERATION=0
RESUME_ACTIVE="$RESUME_MODE"

while [[ $CURRENT_ITERATION -lt $MAX_ITERATIONS ]]; do
  CURRENT_ITERATION=$((CURRENT_ITERATION + 1))

  echo ""
  ui_banner "Iteration $CURRENT_ITERATION / $MAX_ITERATIONS"

  # Re-read state
  ui_dim "Re-reading state from disk..."
  CURRENT_STORY=$(state_get current_story)
  CURRENT_BRANCH=$(state_get branch)
  CURRENT_STATUS=$(state_get status)
  CURRENT_ATTEMPTS=$(state_get attempts)

  # Determine story to work on
  STORY_ID=""
  BRANCH_NAME=""

  if [[ "$RESUME_ACTIVE" == "true" && -n "$CURRENT_STORY" ]]; then
    STORY_ID="$CURRENT_STORY"
    BRANCH_NAME="$CURRENT_BRANCH"
    ui_status "Resuming story: $STORY_ID"
    RESUME_ACTIVE=false
  elif [[ -n "$CURRENT_STORY" ]]; then
    STORY_ID="$CURRENT_STORY"
    BRANCH_NAME="$CURRENT_BRANCH"
    ui_status "Continuing story: $STORY_ID"
  else
    ui_status "Finding next story..."
    STORY_ID=$(prd_get_next_story)
    if [[ -z "$STORY_ID" ]]; then
      ui_warn "No stories available (all complete or blocked)"
      break
    fi
    ui_success "Selected: $STORY_ID"

    ui_status "Setting up branch..."
    BRANCH_NAME=$(prd_get_branch_name "$STORY_ID")
    git_create_story_branch "$BRANCH_NAME"
  fi

  if [[ -z "$STORY_ID" ]]; then
    ui_warn "No story to work on"
    break
  fi

  # Update state
  CURRENT_ATTEMPTS=$((CURRENT_ATTEMPTS + 1))
  STARTED_AT=$(state_get started_at)
  if [[ -z "$STARTED_AT" || "$STARTED_AT" == "null" ]]; then
    STARTED_AT=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  fi
  state_update "current_story=$STORY_ID" "branch=$BRANCH_NAME" "status=in_progress" "attempts=$CURRENT_ATTEMPTS" "started_at=$STARTED_AT"

  git_ensure_on_branch "$BRANCH_NAME"

  # Log activity
  activity_log_entry "Started $STORY_ID (attempt $CURRENT_ATTEMPTS)" "$STORY_ID"

  # Prepare Claude prompt
  claude_prepare "$STORY_ID" "$BRANCH_NAME" "$CURRENT_ATTEMPTS" "$CURRENT_ITERATION" ""

  ui_status "Running Claude (attempt $CURRENT_ATTEMPTS)..."
  ui_dim "  Story:  $STORY_ID"
  ui_dim "  Title:  $CLAUDE_STORY_TITLE"
  ui_dim "  Branch: $BRANCH_NAME"
  ui_dim "  Output: $CLAUDE_OUTPUT_FILE"
  echo ""

  ui_status "Invoking Claude CLI..."
  ui_dim "  This may take several minutes. Claude is working autonomously."
  if [[ "$QUIET_MODE" == "true" ]]; then
    ui_dim "  Quiet mode: output captured to file only."
  else
    ui_dim "  Streaming mode: real-time output."
  fi
  ui_dim "  Waiting for completion signal..."
  echo ""

  ui_divider "Claude Working"

  # Run Claude
  claude_run || true

  # Format Go files
  echo ""
  ui_status "Formatting Go files..."
  GO_FILES=$(git_get_modified_go_files)
  if [[ -n "$GO_FILES" ]]; then
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      gofmt -w "$PROJECT_ROOT/$f" 2>/dev/null || true
    done <<< "$GO_FILES"
    ui_success "  Go formatting complete"
  else
    ui_dim "  No Go files need formatting"
  fi
  echo ""

  # Check signals
  ui_status "Checking for completion signals..."
  claude_check_signals "$CLAUDE_OUTPUT_FILE" "$STORY_ID"
  if [[ "$SIGNAL_COMPLETE" == "true" ]]; then
    ui_dim "  Found: <story-complete>"
  elif [[ "$SIGNAL_BLOCKED" == "true" ]]; then
    ui_dim "  Found: <story-blocked>"
  elif [[ "$SIGNAL_ALL_COMPLETE" == "true" ]]; then
    ui_dim "  Found: <promise>COMPLETE</promise>"
  else
    ui_dim "  No completion signal found (story still in progress)"
  fi
  claude_cleanup
  echo ""

  ui_status "Updating state based on outcome..."

  if [[ "$SIGNAL_COMPLETE" == "true" ]]; then
    echo ""
    ui_success "Story $STORY_ID completed!"
    activity_log_entry "Completed $STORY_ID" "$STORY_ID"

    # Run PR flow (may request feedback)
    echo ""
    STORY_TITLE=$(prd_get_story_title "$STORY_ID")
    PR_RESULT=$(pr_run_flow "$STORY_ID" "$BRANCH_NAME" "$STORY_TITLE" "$CURRENT_ITERATION")

    # Handle feedback loop - re-run Claude with feedback
    if [[ "$PR_RESULT" == "feedback" && -n "$PR_FEEDBACK" ]]; then
      echo ""
      ui_banner "Feedback Loop - Re-running Claude"
      ui_dim "Feedback: $PR_FEEDBACK"
      echo ""

      # Increment attempts
      CURRENT_ATTEMPTS=$((CURRENT_ATTEMPTS + 1))
      state_update "attempts=$CURRENT_ATTEMPTS"

      # Prepare Claude with feedback
      claude_prepare "$STORY_ID" "$BRANCH_NAME" "$CURRENT_ATTEMPTS" "$CURRENT_ITERATION" "$PR_FEEDBACK"

      ui_status "Running Claude with feedback (attempt $CURRENT_ATTEMPTS)..."
      ui_dim "  Story:  $STORY_ID"
      ui_dim "  Branch: $BRANCH_NAME"
      ui_dim "  Output: $CLAUDE_OUTPUT_FILE"
      echo ""

      ui_divider "Claude Working (Feedback)"

      # Run Claude
      claude_run || true

      # Format Go files
      echo ""
      ui_status "Formatting Go files..."
      GO_FILES=$(git_get_modified_go_files)
      if [[ -n "$GO_FILES" ]]; then
        while IFS= read -r f; do
          [[ -z "$f" ]] && continue
          gofmt -w "$PROJECT_ROOT/$f" 2>/dev/null || true
        done <<< "$GO_FILES"
        ui_success "  Go formatting complete"
      else
        ui_dim "  No Go files need formatting"
      fi
      echo ""

      # Check signals again
      ui_status "Checking for completion signals..."
      claude_check_signals "$CLAUDE_OUTPUT_FILE" "$STORY_ID"
      claude_cleanup
      echo ""

      # If complete again, loop back to PR flow
      if [[ "$SIGNAL_COMPLETE" == "true" ]]; then
        ui_success "Feedback addressed! Running PR flow again..."
        # Don't reset state yet - go back to top of loop to handle PR
        continue
      elif [[ "$SIGNAL_BLOCKED" == "true" ]]; then
        ui_error "Story became BLOCKED after feedback"
        activity_log_entry "BLOCKED $STORY_ID after feedback" "$STORY_ID"
        state_update "status=blocked" "current_story=null" "branch=null" "started_at=null" "attempts=0"
      else
        ui_dim "Story still in progress after feedback..."
      fi
    elif [[ "$PR_RESULT" == "merged" ]]; then
      # Successfully merged - reset state
      ui_dim "  Resetting state to idle..."
      state_update "current_story=null" "branch=null" "status=idle" "started_at=null" "attempts=0" "error=null"
      ui_dim "  State saved."

      # Sync base branch
      echo ""
      git_sync_base_branch

      # Pause before next story
      echo ""
      ui_status "Pausing before next story..."
      echo -e "\033[33mStop loop? [y/N]\033[0m \033[2m(continues in 120s)\033[0m"
      if read -t 120 -n 1 answer </dev/tty 2>/dev/null; then
        if [[ "$answer" =~ ^[yY]$ ]]; then
          echo ""
          ui_warn "Stopped by user."
          ui_dim "Run again to continue."
          exit 0
        fi
      else
        ui_dim "(Timeout - continuing)"
      fi
      echo ""
      ui_dim "Continuing to next story..."
    else
      # PR left open or skipped
      ui_dim "PR not merged. Resetting state..."
      state_update "current_story=null" "branch=null" "status=idle" "started_at=null" "attempts=0" "error=null"
    fi

  elif [[ "$SIGNAL_BLOCKED" == "true" ]]; then
    echo ""
    ui_error "Story $STORY_ID is BLOCKED"
    activity_log_entry "BLOCKED $STORY_ID" "$STORY_ID"
    ui_dim "  Clearing story state..."
    state_update "status=blocked" "current_story=null" "branch=null" "started_at=null" "attempts=0"
    ui_dim "  State saved."

  else
    ui_dim "  Story still in progress..."
  fi

  if [[ "$SIGNAL_ALL_COMPLETE" == "true" ]]; then
    echo ""
    ui_box "ALL STORIES COMPLETE!" "success"
    ui_dim "Total iterations: $CURRENT_ITERATION"
    exit 0
  fi

  sleep 2
done

echo ""
ui_box "MAX ITERATIONS REACHED" "warn"
ui_dim "Iterations: $MAX_ITERATIONS"
ui_dim "Run again to continue."
exit 0
