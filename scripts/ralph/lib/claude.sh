#!/usr/bin/env bash
# Claude invocation for Ralph

# Configuration (set by init)
CLAUDE_PROJECT_ROOT=""
CLAUDE_PROMPT_TEMPLATE=""
CLAUDE_TIMEOUT=1800
CLAUDE_QUIET_MODE=false
CLAUDE_MAX_ITERATIONS=100

# Initialize with configuration
claude_init() {
  CLAUDE_PROJECT_ROOT="$1"
  CLAUDE_PROMPT_TEMPLATE="$2"
  CLAUDE_TIMEOUT="$3"
  CLAUDE_QUIET_MODE="$4"
  CLAUDE_MAX_ITERATIONS="$5"
}

# Prepare prompt and set global vars for paths
# Sets: CLAUDE_PROMPT_FILE, CLAUDE_OUTPUT_FILE, CLAUDE_STORY_TITLE
claude_prepare() {
  local story_id="$1"
  local branch_name="$2"
  local attempt="$3"
  local iteration="$4"
  local feedback="$5"

  # Build feedback section if provided
  local feedback_section=""
  if [[ -n "$feedback" ]]; then
    feedback_section="## User Feedback (Refinement Request)

The user has reviewed your work and requested the following changes:

> $feedback

**Instructions:**
1. Read the feedback carefully
2. Make the requested changes
3. Run the full verification (build, test, self-review)
4. Commit and push when done
5. Output the completion signal

Stay focused on the feedback - don't refactor unrelated code.
"
  fi

  # Build prompt from template
  local prompt="$CLAUDE_PROMPT_TEMPLATE"
  prompt="${prompt//\{\{ITERATION\}\}/$iteration}"
  prompt="${prompt//\{\{MAX_ITERATIONS\}\}/$CLAUDE_MAX_ITERATIONS}"
  prompt="${prompt//\{\{CURRENT_STORY\}\}/$story_id}"
  prompt="${prompt//\{\{BRANCH\}\}/$branch_name}"
  prompt="${prompt//\{\{ATTEMPT\}\}/$attempt}"
  prompt="${prompt//\{\{FEEDBACK\}\}/$feedback_section}"

  # Add dependency info
  local deps_info
  deps_info=$(prd_get_story_deps "$story_id")
  prompt="${prompt//\{\{DEPENDENCIES\}\}/$deps_info}"

  CLAUDE_OUTPUT_FILE=$(mktemp)
  CLAUDE_PROMPT_FILE=$(mktemp)
  echo "$prompt" > "$CLAUDE_PROMPT_FILE"

  # Get story title for display
  CLAUDE_STORY_TITLE=$(prd_get_story_title "$story_id")
}

# Run Claude with streaming output
# Returns exit code: 0 = success, 1 = error, 124 = timeout
claude_run() {
  local timeout_cmd
  timeout_cmd=$(get_timeout_cmd)

  cd "$CLAUDE_PROJECT_ROOT" || return 1

  local start_time
  start_time=$(date +%s)

  local exit_code=0

  if [[ "$CLAUDE_QUIET_MODE" == "true" ]]; then
    # Quiet mode - capture to file only
    if ! $timeout_cmd "$CLAUDE_TIMEOUT" bash -c 'claude --dangerously-skip-permissions --print < "$1"' _ "$CLAUDE_PROMPT_FILE" > "$CLAUDE_OUTPUT_FILE" 2>&1; then
      exit_code=$?
    fi
  else
    # Streaming mode - real-time output
    # jq filters from https://www.aihero.dev/heres-how-to-stream-claude-code-with-afk-ralph
    local stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
    local final_result='select(.type == "result").result // empty'

    # Run streaming pipeline
    set +e
    $timeout_cmd "$CLAUDE_TIMEOUT" claude --dangerously-skip-permissions --verbose --print --output-format stream-json < "$CLAUDE_PROMPT_FILE" 2>&1 | \
      grep --line-buffered '^{' | \
      tee "$CLAUDE_OUTPUT_FILE" | \
      jq --unbuffered -rj "$stream_text" 2>/dev/null
    exit_code=$?
    set -e

    # Extract final result text for signal detection
    if jq -rs "$final_result" "$CLAUDE_OUTPUT_FILE" > "$CLAUDE_OUTPUT_FILE.result" 2>/dev/null; then
      local result_content
      result_content=$(cat "$CLAUDE_OUTPUT_FILE.result")
      if [[ -n "$result_content" ]]; then
        echo "$result_content" > "$CLAUDE_OUTPUT_FILE"
      fi
    fi
    rm -f "$CLAUDE_OUTPUT_FILE.result"
  fi

  local end_time
  end_time=$(date +%s)
  local duration=$((end_time - start_time))

  if [[ $exit_code -eq 124 ]]; then
    ui_divider_end
    ui_error "Claude execution TIMED OUT after ${CLAUDE_TIMEOUT}s"
    return 124
  elif [[ $exit_code -ne 0 ]]; then
    ui_divider_end
    ui_error "Claude execution error (exit code: $exit_code)"
    return 1
  fi

  ui_divider_end
  ui_success "Claude execution completed in ${duration}s"
  return 0
}

# Check output file for completion signals
# Sets: SIGNAL_COMPLETE, SIGNAL_BLOCKED, SIGNAL_ALL_COMPLETE
claude_check_signals() {
  local output_file="$1"
  local story_id="$2"

  SIGNAL_COMPLETE=false
  SIGNAL_BLOCKED=false
  SIGNAL_ALL_COMPLETE=false

  if grep -q "<story-complete>${story_id}</story-complete>" "$output_file" 2>/dev/null; then
    SIGNAL_COMPLETE=true
  fi

  if grep -q "<story-blocked>${story_id}</story-blocked>" "$output_file" 2>/dev/null; then
    SIGNAL_BLOCKED=true
  fi

  if grep -q "<promise>COMPLETE</promise>" "$output_file" 2>/dev/null; then
    SIGNAL_ALL_COMPLETE=true
  fi
}

# Cleanup temp files
claude_cleanup() {
  rm -f "$CLAUDE_PROMPT_FILE" "$CLAUDE_OUTPUT_FILE" "$CLAUDE_OUTPUT_FILE.result" 2>/dev/null
  ui_dim "  Cleaned up temp files"
}
