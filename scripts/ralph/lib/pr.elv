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

# Global to store feedback for main loop
var feedback = ""

# Get feedback text from user
fn get-feedback {
  echo "" > /dev/tty
  ui:status "Enter feedback for Claude (press Enter twice to finish):" > /dev/tty
  echo "\e[2m(Describe what changes are needed)\e[0m" > /dev/tty

  var fb = ""
  var line = ""
  while $true {
    try {
      set line = (str:trim-space (bash -c 'read line </dev/tty 2>/dev/null; echo "$line"'))
      if (eq $line "") {
        break
      }
      if (eq $fb "") {
        set fb = $line
      } else {
        set fb = $fb"\n"$line
      }
    } catch {
      break
    }
  }
  put $fb
}

# Get the stored feedback
fn get-stored-feedback {
  put $feedback
}

# Run the full PR and merge flow with feedback loops
# Returns: "merged", "open", "skipped", or "feedback"
fn run-flow {|story-id branch-name story-title current-iteration|
  var pr-url = ""
  var pr-exists = $false
  set feedback = ""  # Reset feedback

  # Check if PR already exists
  set pr-url = (check-exists $branch-name)
  if (not (eq $pr-url "")) {
    set pr-exists = $true
  }

  # === PR PROMPT ===
  if $pr-exists {
    ui:dim "PR exists: "$pr-url > /dev/tty

    if (not $auto-pr) {
      ui:status "Review the PR. What would you like to do?" > /dev/tty
      echo "\e[33m[Y]es update / [n]o skip / [f]eedback request changes\e[0m" > /dev/tty

      var answer = (prompt-user 0)
      if (re:match '^[nN]$' $answer) {
        ui:dim "Skipping PR update" > /dev/tty
      } elif (re:match '^[fF]$' $answer) {
        set feedback = (get-feedback)
        if (not (eq $feedback "")) {
          ui:status "Feedback received. Will re-run Claude with changes..." > /dev/tty
          put "feedback"
          return
        }
      } else {
        update $branch-name $story-id $story-title
      }
    } else {
      update $branch-name $story-id $story-title
    }
  } else {
    # No PR - ask to create
    if (not $auto-pr) {
      ui:status "Create PR to "$base-branch"?" > /dev/tty
      echo "\e[33m[Y]es / [n]o\e[0m" > /dev/tty

      var answer = (prompt-user 0)
      if (re:match '^[nN]$' $answer) {
        ui:dim "Skipping PR (branch pushed: "$branch-name")" > /dev/tty
        put "skipped"
        return
      }
    }

    set pr-url = (create $branch-name $story-id $story-title)
    if (not (eq $pr-url "")) {
      set pr-exists = $true
    }
  }

  # === MERGE PROMPT ===
  if (and $pr-exists (not $auto-merge)) {
    echo "" > /dev/tty
    ui:status "What would you like to do?" > /dev/tty
    echo "\e[33m[y]es merge / [N]o leave open / [f]eedback request changes\e[0m" > /dev/tty

    var answer = (prompt-user 0)
    if (re:match '^[yY]$' $answer) {
      var commit = (merge $branch-name)
      if (not (eq $commit "")) {
        prd:mark-merged $story-id $commit
      }
      put "merged"
    } elif (re:match '^[fF]$' $answer) {
      set feedback = (get-feedback)
      if (not (eq $feedback "")) {
        ui:status "Feedback received. Will re-run Claude with changes..." > /dev/tty
        put "feedback"
      } else {
        ui:dim "No feedback provided, leaving PR open" > /dev/tty
        put "open"
      }
    } else {
      # Default to no (leave open for review)
      ui:dim "PR left open for review" > /dev/tty
      put "open"
    }
  } elif $auto-merge {
    var commit = (merge $branch-name)
    if (not (eq $commit "")) {
      prd:mark-merged $story-id $commit
    }
    put "merged"
  } else {
    put "open"
  }
}
