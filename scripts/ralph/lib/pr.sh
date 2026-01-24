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

# Build PR body from commits and changes
pr_build_body() {
  local story_id="$1"
  local story_title="$2"
  local branch_name="$3"

  # Get commit messages since branching from base
  local commits
  commits=$(git -C "$PR_PROJECT_ROOT" log --oneline "$PR_BASE_BRANCH".."$branch_name" 2>/dev/null | head -20)

  # Get changed files
  local files_changed
  files_changed=$(git -C "$PR_PROJECT_ROOT" diff --stat "$PR_BASE_BRANCH".."$branch_name" 2>/dev/null | tail -1)

  cat << EOF
## $story_id: $story_title

### Commits
\`\`\`
$commits
\`\`\`

### Summary
$files_changed
EOF
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

# Update PR description based on commits
pr_update_description() {
  local branch_name="$1"
  local story_id="$2"
  local story_title="$3"

  ui_status "Updating PR description..."

  local body
  body=$(pr_build_body "$story_id" "$story_title" "$branch_name")

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

# Run the full PR and merge flow with feedback loops
pr_run_flow() {
  local story_id="$1"
  local branch_name="$2"
  local story_title="$3"
  local current_iteration="$4"

  local pr_url=""
  local pr_exists=false

  # Check if PR already exists
  pr_url=$(pr_check_exists "$branch_name")
  if [[ -n "$pr_url" ]]; then
    pr_exists=true
  fi

  local done=false
  while [[ "$done" == "false" ]]; do
    # === PR HANDLING ===
    if [[ "$pr_exists" == "true" ]]; then
      # PR exists - ask to update description
      ui_dim "PR exists: $pr_url"

      if [[ "$PR_AUTO_PR" != "true" ]]; then
        ui_status "Update PR description with latest changes?"
        echo -e "\033[33m[Y]es / [n]o\033[0m"

        local answer
        answer=$(pr_prompt_user)
        case "$answer" in
          no) ;;
          *) pr_update_description "$branch_name" "$story_id" "$story_title" ;;
        esac
      else
        pr_update_description "$branch_name" "$story_id" "$story_title"
      fi
    else
      # No PR - ask to create
      local should_create_pr="$PR_AUTO_PR"

      if [[ "$PR_AUTO_PR" != "true" ]]; then
        ui_status "Create PR to $PR_BASE_BRANCH?"
        echo -e "\033[33m[Y]es / [n]o\033[0m"

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
        done=true
        continue
      fi
    fi

    # === MERGE PROMPT ===
    if [[ "$pr_exists" == "true" && "$PR_AUTO_MERGE" != "true" ]]; then
      echo ""
      ui_status "Merge PR?"
      echo -e "\033[33m[y]es / [N]o\033[0m"

      local answer
      answer=$(pr_prompt_user)
      if [[ "$answer" == "yes" ]]; then
        local commit
        commit=$(pr_merge "$branch_name")
        if [[ -n "$commit" ]]; then
          prd_mark_merged "$story_id" "$commit"
        fi
        done=true
      else
        # Default to no (leave open for review)
        ui_dim "PR left open for review"
        done=true
      fi
    elif [[ "$PR_AUTO_MERGE" == "true" ]]; then
      local commit
      commit=$(pr_merge "$branch_name")
      if [[ -n "$commit" ]]; then
        prd_mark_merged "$story_id" "$commit"
      fi
      done=true
    else
      done=true
    fi
  done
}
