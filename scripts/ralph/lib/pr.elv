# PR and merge flow with feedback loops for Ralph

use str
use re
use ./ui
use ./prd

# Configuration (set by init)
var project-root = ""
var base-branch = "dev"
var auto-pr = $true
var auto-merge = $false

# Initialize module
fn init {|root branch apr amerge|
  set project-root = $root
  set base-branch = $branch
  set auto-pr = $apr
  set auto-merge = $amerge
}

# Check if PR exists for branch
fn check-exists {|branch-name|
  try {
    var existing = (gh pr view $branch-name --json url -q '.url' 2>/dev/null | slurp)
    if (not (eq (str:trim-space $existing) "")) {
      put (str:trim-space $existing)
      return
    }
  } catch _ { }
  put ""
}

# Build PR body using Claude to summarize ALL changes
fn build-body {|story-id story-title branch-name|
  ui:dim "  Generating PR description with Claude..." > /dev/tty

  # Get ALL commits for this PR
  var commits = ""
  try {
    set commits = (git -C $project-root log --oneline $base-branch".."$branch-name 2>/dev/null | slurp)
  } catch _ { }

  # Get file stats
  var stats = ""
  try {
    set stats = (git -C $project-root diff --stat $base-branch".."$branch-name 2>/dev/null | slurp)
  } catch _ { }

  # Get files changed
  var files-changed = ""
  try {
    set files-changed = (git -C $project-root diff --name-status $base-branch".."$branch-name 2>/dev/null | slurp)
  } catch _ { }

  # Get diff (limited)
  var diff = ""
  try {
    set diff = (git -C $project-root diff $base-branch".."$branch-name 2>/dev/null | head -1000 | slurp)
  } catch _ { }

  # Build prompt
  var prompt = "Write a comprehensive GitHub PR description based on the FULL git history below.

Story: "$story-id" - "$story-title"

ALL COMMITS IN THIS PR:
"$commits"

ALL FILES CHANGED:
"$files-changed"

FILE STATS:
"$stats"

DIFF (truncated):
"$diff"

Format:
## Summary
<2-3 sentence summary of what this PR accomplishes overall>

## Changes
<bullet points covering ALL significant changes, grouped by feature/area>

## Testing
<how to verify the changes work>

Output just the formatted PR description, no preamble."

  # Call Claude
  var body = ""
  try {
    set body = (echo $prompt | claude --dangerously-skip-permissions --print 2>/dev/null | slurp)
  } catch _ { }

  # Fallback if Claude fails
  if (eq (str:trim-space $body) "") {
    ui:dim "  Claude unavailable, using basic template" > /dev/tty
    set body = "## "$story-id": "$story-title"

### Commits
```
"$commits"
```

### Changes
"$stats
  }

  put $body
}

# Create a new PR with Claude-generated description
fn create {|branch-name story-id story-title|
  ui:status "Creating PR to "$base-branch"..." > /dev/tty

  var body = (build-body $story-id $story-title $branch-name)

  try {
    var url = (gh pr create --base $base-branch --head $branch-name --title $story-id": "$story-title --body $body 2>&1 | slurp)
    set url = (str:trim-space $url)
    ui:success "PR created: "$url > /dev/tty
    put $url
  } catch e {
    ui:error "Failed to create PR: "(to-string $e[reason]) > /dev/tty
    put ""
  }
}

# Update PR description with Claude-generated content
fn update {|branch-name story-id story-title|
  ui:status "Updating PR description..." > /dev/tty

  var body = (build-body $story-id $story-title $branch-name)

  try {
    gh pr edit $branch-name --body $body 2>&1 | slurp
    ui:success "PR description updated" > /dev/tty
    put $true
  } catch e {
    ui:error "Failed to update PR: "(to-string $e[reason]) > /dev/tty
    put $false
  }
}

# Merge PR - returns merge commit SHA or empty string on failure
fn merge {|branch-name|
  ui:status "Merging PR..." > /dev/tty
  try {
    gh pr merge $branch-name --squash --delete-branch 2>&1 | slurp
    # Get the merge commit SHA from base branch
    var merge-commit = (str:trim-space (git -C $project-root rev-parse $base-branch | slurp))
    ui:success "PR merged (commit: "$merge-commit")" > /dev/tty
    put $merge-commit
  } catch e {
    ui:error "Failed to merge PR: "(to-string $e[reason]) > /dev/tty
    put ""
  }
}

# Push changes to remote
fn push-changes {|branch-name|
  ui:dim "Pushing refinement changes..." > /dev/tty
  try {
    git -C $project-root push origin $branch-name 2>&1 | slurp
    ui:success "Changes pushed" > /dev/tty
    put $true
  } catch _ {
    put $false
  }
}

# Prompt user, return answer (timeout 0 = wait forever)
fn prompt-user {|timeout|
  try {
    var cmd = 'read ans 2>/dev/null; echo "$ans"'
    if (> $timeout 0) {
      set cmd = 'read -t '$timeout' ans 2>/dev/null; echo "$ans"'
    }
    var answer = (str:trim-space (bash -c $cmd </dev/tty 2>/dev/null))
    put $answer
  } catch {
    put ""
  }
}

# Run the full PR and merge flow with feedback loops
# Returns: $true if flow completed, $false if skipped
fn run-flow {|story-id branch-name story-title current-iteration|
  var pr-url = ""
  var pr-exists = $false
  var done = $false

  # Check if PR already exists
  set pr-url = (check-exists $branch-name)
  if (not (eq $pr-url "")) {
    set pr-exists = $true
  }

  while (not $done) {
    # === PR PROMPT ===
    var should-handle-pr = $auto-pr

    if (not $auto-pr) {
      if $pr-exists {
        ui:status "Update PR description?"
      } else {
        ui:status "Create PR to "$base-branch"?"
      }
      echo "\e[33m[Y]es / [n]o\e[0m"

      var answer = (prompt-user 0)
      if (re:match '^[nN]$' $answer) {
        set should-handle-pr = $false
      } elif (re:match '^[yY]$' $answer) {
        set should-handle-pr = $true
      } else {
        # Default to yes if just enter
        set should-handle-pr = $true
      }
    }

    # Handle PR create/update
    if $should-handle-pr {
      if $pr-exists {
        update $branch-name $story-id $story-title
        ui:dim "PR: "$pr-url > /dev/tty
      } else {
        set pr-url = (create $branch-name $story-id $story-title)
        if (not (eq $pr-url "")) {
          set pr-exists = $true
        }
      }
    } else {
      ui:dim "Skipping PR (branch pushed: "$branch-name")"
      set done = $true
      continue
    }

    # === MERGE PROMPT ===
    if (and $pr-exists (not $auto-merge)) {
      echo ""
      ui:status "Merge PR?"
      echo "\e[33m[y]es / [N]o\e[0m"

      var answer = (prompt-user 0)
      if (re:match '^[yY]$' $answer) {
        var commit = (merge $branch-name)
        if (not (eq $commit "")) {
          prd:mark-merged $story-id $commit
        }
        set done = $true
      } else {
        # Default to no (leave open for review)
        ui:dim "PR left open for review"
        set done = $true
      }
    } elif $auto-merge {
      var commit = (merge $branch-name)
      if (not (eq $commit "")) {
        prd:mark-merged $story-id $commit
      }
      set done = $true
    } else {
      set done = $true
    }
  }
}
