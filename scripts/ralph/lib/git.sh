#!/usr/bin/env bash
# Git operations for Ralph

# Configuration (set by init)
GIT_PROJECT_ROOT=""
GIT_BASE_BRANCH="dev"

# Initialize with project root and base branch
git_init() {
  GIT_PROJECT_ROOT="$1"
  GIT_BASE_BRANCH="$2"
}

# Get current branch name
git_current_branch() {
  git -C "$GIT_PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null
}

# Check if branch exists (local or remote)
git_branch_exists() {
  local branch="$1"

  if git -C "$GIT_PROJECT_ROOT" rev-parse --verify "refs/heads/$branch" &>/dev/null; then
    return 0
  fi

  if git -C "$GIT_PROJECT_ROOT" rev-parse --verify "refs/remotes/origin/$branch" &>/dev/null; then
    return 0
  fi

  return 1
}

# Create or switch to story branch
git_create_story_branch() {
  local branch_name="$1"

  if git_branch_exists "$branch_name"; then
    ui_dim "  Branch $branch_name already exists, switching to it"
    git -C "$GIT_PROJECT_ROOT" checkout "$branch_name" &>/dev/null
  else
    ui_dim "  Creating branch $branch_name from $GIT_BASE_BRANCH"
    git -C "$GIT_PROJECT_ROOT" fetch origin "$GIT_BASE_BRANCH" &>/dev/null
    git -C "$GIT_PROJECT_ROOT" checkout "$GIT_BASE_BRANCH" &>/dev/null
    git -C "$GIT_PROJECT_ROOT" reset --hard "origin/$GIT_BASE_BRANCH" &>/dev/null
    git -C "$GIT_PROJECT_ROOT" checkout -b "$branch_name" &>/dev/null
  fi
}

# Ensure we're on the specified branch
git_ensure_on_branch() {
  local branch="$1"
  local current
  current=$(git_current_branch)

  if [[ "$current" != "$branch" ]]; then
    if git_branch_exists "$branch"; then
      ui_dim "  Switching to branch $branch"
      git -C "$GIT_PROJECT_ROOT" checkout "$branch" &>/dev/null
    else
      ui_dim "  Branch $branch not found, recreating from $GIT_BASE_BRANCH"
      git -C "$GIT_PROJECT_ROOT" fetch origin "$GIT_BASE_BRANCH" &>/dev/null
      git -C "$GIT_PROJECT_ROOT" checkout "$GIT_BASE_BRANCH" &>/dev/null
      git -C "$GIT_PROJECT_ROOT" reset --hard "origin/$GIT_BASE_BRANCH" &>/dev/null
      git -C "$GIT_PROJECT_ROOT" checkout -b "$branch" &>/dev/null
    fi
  fi
}

# Sync local base branch with remote
git_sync_base_branch() {
  ui_dim "  Syncing local $GIT_BASE_BRANCH with remote..."
  if git -C "$GIT_PROJECT_ROOT" fetch origin "$GIT_BASE_BRANCH" &>/dev/null && \
     git -C "$GIT_PROJECT_ROOT" checkout "$GIT_BASE_BRANCH" &>/dev/null && \
     git -C "$GIT_PROJECT_ROOT" reset --hard "origin/$GIT_BASE_BRANCH" &>/dev/null; then
    ui_success "  Local $GIT_BASE_BRANCH synced with remote."
  else
    ui_dim "  ($GIT_BASE_BRANCH sync skipped - may need manual intervention)"
  fi
}

# Push branch to remote
git_push_branch() {
  local branch="$1"
  ui_dim "Pushing $branch to remote..."
  if git -C "$GIT_PROJECT_ROOT" push -u origin "$branch" &>/dev/null; then
    ui_success "Branch pushed"
  fi
}

# Get modified Go files
git_get_modified_go_files() {
  git -C "$GIT_PROJECT_ROOT" diff --name-only HEAD~1 2>/dev/null | grep '\.go$' || true
}
