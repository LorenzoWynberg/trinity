# Git operations for Ralph

use str
use ./ui

# Configuration (set by init)
var project-root = ""
var base-branch = "dev"

# Initialize with project root and base branch
fn init {|root branch|
  set project-root = $root
  set base-branch = $branch
}

# Get current branch name
fn current-branch {
  try { str:trim-space (git -C $project-root rev-parse --abbrev-ref HEAD | slurp) } catch _ { put "" }
}

# Check if branch exists (local or remote)
fn branch-exists {|branch|
  try {
    git -C $project-root rev-parse --verify "refs/heads/"$branch > /dev/null 2>&1
    put $true
  } catch {
    try {
      git -C $project-root rev-parse --verify "refs/remotes/origin/"$branch > /dev/null 2>&1
      put $true
    } catch {
      put $false
    }
  }
}

# Create or switch to story branch
fn create-story-branch {|branch-name|
  if (branch-exists $branch-name) {
    ui:dim "  Branch "$branch-name" already exists, switching to it"
    git -C $project-root checkout $branch-name > /dev/null 2>&1
  } else {
    ui:dim "  Creating branch "$branch-name" from "$base-branch
    git -C $project-root fetch origin $base-branch > /dev/null 2>&1
    git -C $project-root checkout $base-branch > /dev/null 2>&1
    git -C $project-root reset --hard origin/$base-branch > /dev/null 2>&1
    git -C $project-root checkout -b $branch-name > /dev/null 2>&1
  }
}

# Ensure we're on the specified branch
fn ensure-on-branch {|branch|
  var current = (current-branch)
  if (not (eq $current $branch)) {
    if (branch-exists $branch) {
      ui:dim "  Switching to branch "$branch
      git -C $project-root checkout $branch > /dev/null 2>&1
    } else {
      ui:dim "  Branch "$branch" not found, recreating from "$base-branch
      git -C $project-root fetch origin $base-branch > /dev/null 2>&1
      git -C $project-root checkout $base-branch > /dev/null 2>&1
      git -C $project-root reset --hard origin/$base-branch > /dev/null 2>&1
      git -C $project-root checkout -b $branch > /dev/null 2>&1
    }
  }
}

# Sync local base branch with remote
fn sync-base-branch {
  ui:dim "  Syncing local "$base-branch" with remote..."
  try {
    git -C $project-root fetch origin $base-branch > /dev/null 2>&1
    git -C $project-root checkout $base-branch > /dev/null 2>&1
    git -C $project-root reset --hard origin/$base-branch > /dev/null 2>&1
    ui:success "  Local "$base-branch" synced with remote."
  } catch {
    ui:dim "  ("$base-branch" sync skipped - may need manual intervention)"
  }
}

# Push branch to remote
fn push-branch {|branch|
  ui:dim "Pushing "$branch" to remote..."
  try {
    git -C $project-root push -u origin $branch 2>&1 | slurp
    ui:success "Branch pushed"
  } catch _ { }
}

# Get modified Go files
fn get-modified-go-files {
  try {
    var files = [(git -C $project-root diff --name-only HEAD~1 2>/dev/null | grep '\.go$')]
    put $@files
  } catch {
    # No files or error
  }
}
