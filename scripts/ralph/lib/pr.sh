#!/usr/bin/env bash
# PR and merge flow with feedback loops for Ralph

# Configuration (set by init)
PR_PROJECT_ROOT=""
PR_BASE_BRANCH="dev"
PR_AUTO_PR=false
PR_AUTO_MERGE=false

# Initialize module
pr_init() {
  PR_PROJECT_ROOT="$1"
  PR_BASE_BRANCH="$2"
  PR_AUTO_PR="$3"
  PR_AUTO_MERGE="$4"
}

# Check if PR exists for branch
# Returns PR URL or empty string
pr_check_exists() {
  local branch_name="$1"
  local existing
  existing=$(gh pr view "$branch_name" --json url -q '.url' 2>/dev/null || true)
  echo "$existing"
}

# Build PR body using Claude to summarize changes
# If existing_body is provided, Claude will merge/extend it
pr_build_body() {
  local story_id="$1"
  local story_title="$2"
  local branch_name="$3"
  local existing_body="${4:-}"

  ui_dim "  Generating PR description with Claude..."

  # Get ALL commit messages for this PR (full history from base)
  local commits
  commits=$(git -C "$PR_PROJECT_ROOT" log --oneline "$PR_BASE_BRANCH".."$branch_name" 2>/dev/null)

  # Get full file stats (shows all changed files)
  local stats
  stats=$(git -C "$PR_PROJECT_ROOT" diff --stat "$PR_BASE_BRANCH".."$branch_name" 2>/dev/null)

  # Get file list with change types
  local files_changed
  files_changed=$(git -C "$PR_PROJECT_ROOT" diff --name-status "$PR_BASE_BRANCH".."$branch_name" 2>/dev/null)

  # Get diff - limit per file to avoid token explosion but include all files
  local diff
  diff=$(git -C "$PR_PROJECT_ROOT" diff "$PR_BASE_BRANCH".."$branch_name" 2>/dev/null | head -1000)

  # Build prompt for Claude - always generate fresh from git history
  local prompt
  prompt="Write a comprehensive GitHub PR description based on the FULL git history below.

Story: $story_id - $story_title

ALL COMMITS IN THIS PR (oldest to newest):
$commits

ALL FILES CHANGED:
$files_changed

FILE STATS:
$stats

DIFF (truncated for large changes):
$diff

Instructions:
- Summarize ALL the work done in this PR based on the commits above
- The summary should cover the FULL scope - from initial work to latest changes
- Group related changes together logically
- Be comprehensive but concise

Format:
## Summary
<2-3 sentence summary of what this PR accomplishes overall>

## Changes
<bullet points covering ALL significant changes, grouped by feature/area>

## Testing
<how to verify the changes work>

Output just the formatted PR description, no preamble."

  # Call Claude to generate description
  local body
  body=$(echo "$prompt" | claude --dangerously-skip-permissions --print 2>/dev/null)

  # Fallback if Claude fails
  if [[ -z "$body" ]]; then
    ui_dim "  Claude unavailable, using basic template"
    body="## $story_id: $story_title

### Commits
\`\`\`
$commits
\`\`\`

### Changes
$stats"
  fi

  echo "$body"
}

# Create a new PR
# Returns PR URL or empty string
pr_create() {
  local branch_name="$1"
  local story_id="$2"
  local story_title="$3"

  ui_status "Creating PR to $PR_BASE_BRANCH..."

  local body
  body=$(pr_build_body "$story_id" "$story_title" "$branch_name")

  local url
  if url=$(gh pr create --base "$PR_BASE_BRANCH" --head "$branch_name" --title "$story_id: $story_title" --body "$body" 2>&1); then
    url=$(echo "$url" | tr -d '[:space:]' | grep -o 'https://.*')
    ui_success "PR created: $url"
    echo "$url"
  else
    ui_error "Failed to create PR: $url"
    echo ""
  fi
}

# Update PR description based on commits (merges with existing)
pr_update_description() {
  local branch_name="$1"
  local story_id="$2"
  local story_title="$3"

  ui_status "Updating PR description..."

  # Fetch existing PR body to merge with
  local existing_body
  existing_body=$(gh pr view "$branch_name" --json body -q '.body' 2>/dev/null || true)

  local body
  body=$(pr_build_body "$story_id" "$story_title" "$branch_name" "$existing_body")

  if gh pr edit "$branch_name" --body "$body" &>/dev/null; then
    ui_success "PR description updated"
    return 0
  else
    ui_error "Failed to update PR description"
    return 1
  fi
}

# Merge PR - returns merge commit SHA or empty string on failure
pr_merge() {
  local branch_name="$1"

  ui_status "Merging PR..."

  if gh pr merge "$branch_name" --squash --delete-branch 2>&1; then
    # Get the merge commit SHA from base branch
    local merge_commit
    merge_commit=$(git -C "$PR_PROJECT_ROOT" rev-parse "$PR_BASE_BRANCH" 2>/dev/null)
    ui_success "PR merged (commit: $merge_commit)"
    echo "$merge_commit"
  else
    ui_error "Failed to merge PR"
    echo ""
  fi
}

# Prompt user for yes/no
# Returns: "yes", "no", or "default"
pr_prompt_user() {
  local answer=""
  read -r answer </dev/tty 2>/dev/null || answer=""
  answer=$(echo "$answer" | tr '[:upper:]' '[:lower:]')

  case "$answer" in
    y|yes) echo "yes" ;;
    n|no) echo "no" ;;
    *) echo "default" ;;
  esac
}

# Global to pass feedback back to main loop
PR_FEEDBACK=""

# Prompt for feedback text
pr_get_feedback() {
  echo "" > /dev/tty
  ui_status "Enter feedback for Claude (press Enter twice to finish):"
  echo -e "\033[2m(Describe what changes are needed)\033[0m" > /dev/tty

  local feedback=""
  local line=""
  local empty_lines=0

  while true; do
    IFS= read -r line </dev/tty 2>/dev/null || break
    if [[ -z "$line" ]]; then
      empty_lines=$((empty_lines + 1))
      if [[ $empty_lines -ge 1 ]]; then
        break
      fi
    else
      empty_lines=0
      if [[ -n "$feedback" ]]; then
        feedback="$feedback"$'\n'"$line"
      else
        feedback="$line"
      fi
    fi
  done

  echo "$feedback"
}

# Run the full PR and merge flow with feedback loops
# Returns: "merged", "open", "skipped", or "feedback:<text>"
pr_run_flow() {
  local story_id="$1"
  local branch_name="$2"
  local story_title="$3"
  local current_iteration="$4"

  local pr_url=""
  local pr_exists=false
  PR_FEEDBACK=""

  # Check if PR already exists
  pr_url=$(pr_check_exists "$branch_name")
  if [[ -n "$pr_url" ]]; then
    pr_exists=true
  fi

  local done=false
  while [[ "$done" == "false" ]]; do
    # === PR HANDLING ===
    if [[ "$pr_exists" == "true" ]]; then
      # PR exists - offer update, skip, or feedback
      ui_dim "PR exists: $pr_url"

      if [[ "$PR_AUTO_PR" != "true" ]]; then
        ui_status "Review the PR. What would you like to do?"
        echo -e "\033[33m[Y]es update description / [n]o skip / [f]eedback request changes\033[0m" > /dev/tty

        local answer=""
        read -r answer </dev/tty 2>/dev/null || answer=""
        answer=$(echo "$answer" | tr '[:upper:]' '[:lower:]')

        case "$answer" in
          n|no)
            ui_dim "Skipping PR update"
            ;;
          f|feedback)
            # Get feedback and return to main loop
            local feedback
            feedback=$(pr_get_feedback)
            if [[ -n "$feedback" ]]; then
              PR_FEEDBACK="$feedback"
              ui_status "Feedback received. Will re-run Claude with changes..."
              echo "feedback"
              return 0
            else
              ui_dim "No feedback provided"
            fi
            ;;
          *)
            # Default to yes - update description
            pr_update_description "$branch_name" "$story_id" "$story_title"
            ;;
        esac
      else
        pr_update_description "$branch_name" "$story_id" "$story_title"
      fi
    else
      # No PR - ask to create
      local should_create_pr="$PR_AUTO_PR"

      if [[ "$PR_AUTO_PR" != "true" ]]; then
        ui_status "Create PR to $PR_BASE_BRANCH?"
        echo -e "\033[33m[Y]es / [n]o\033[0m" > /dev/tty

        local answer
        answer=$(pr_prompt_user)
        case "$answer" in
          no) should_create_pr=false ;;
          *) should_create_pr=true ;;
        esac
      fi

      if [[ "$should_create_pr" == "true" ]]; then
        pr_url=$(pr_create "$branch_name" "$story_id" "$story_title")
        if [[ -n "$pr_url" ]]; then
          pr_exists=true
        fi
      else
        ui_dim "Skipping PR (branch pushed: $branch_name)"
        echo "skipped"
        return 0
      fi
    fi

    # === MERGE / FEEDBACK PROMPT ===
    if [[ "$pr_exists" == "true" && "$PR_AUTO_MERGE" != "true" ]]; then
      echo "" > /dev/tty
      ui_status "What would you like to do?"
      echo -e "\033[33m[y]es merge / [N]o leave open / [f]eedback request changes\033[0m" > /dev/tty

      local answer=""
      read -r answer </dev/tty 2>/dev/null || answer=""
      answer=$(echo "$answer" | tr '[:upper:]' '[:lower:]')

      case "$answer" in
        y|yes)
          local commit
          commit=$(pr_merge "$branch_name")
          if [[ -n "$commit" ]]; then
            prd_mark_merged "$story_id" "$commit"
          fi
          echo "merged"
          return 0
          ;;
        f|feedback)
          # Get feedback from user
          local feedback
          feedback=$(pr_get_feedback)
          if [[ -n "$feedback" ]]; then
            PR_FEEDBACK="$feedback"
            ui_status "Feedback received. Will re-run Claude with changes..."
            echo "feedback"
            return 0
          else
            ui_dim "No feedback provided, leaving PR open"
            echo "open"
            return 0
          fi
          ;;
        *)
          # Default to no (leave open for review)
          ui_dim "PR left open for review"
          echo "open"
          return 0
          ;;
      esac
    elif [[ "$PR_AUTO_MERGE" == "true" ]]; then
      local commit
      commit=$(pr_merge "$branch_name")
      if [[ -n "$commit" ]]; then
        prd_mark_merged "$story_id" "$commit"
      fi
      echo "merged"
      return 0
    else
      echo "open"
      return 0
    fi
  done
}
