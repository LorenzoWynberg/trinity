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

# Create a new PR
fn create {|branch-name story-id story-title|
  ui:status "Creating PR to "$base-branch"..."
  try {
    var url = (gh pr create --base $base-branch --head $branch-name --title $story-id": "$story-title --body "Automated PR for "$story-id 2>&1 | slurp)
    set url = (str:trim-space $url)
    ui:success "PR created: "$url
    put $url
  } catch e {
    ui:error "Failed to create PR: "(to-string $e[reason])
    put ""
  }
}

# Update PR description
fn update {|branch-name story-id refinements|
  ui:status "Updating PR description..."
  try {
    var refinement-notes = ""
    if (> (count $refinements) 0) {
      set refinement-notes = "\n\n## Refinements\n"
      for r $refinements {
        set refinement-notes = $refinement-notes"- "$r"\n"
      }
    }
    var new-body = "Automated PR for "$story-id$refinement-notes
    gh pr edit $branch-name --body $new-body 2>&1 | slurp
    put $true
  } catch e {
    ui:error "Failed to update PR: "(to-string $e[reason])
    put $false
  }
}

# Merge PR - returns merge commit SHA or empty string on failure
fn merge {|branch-name|
  ui:status "Merging PR..."
  try {
    gh pr merge $branch-name --squash --delete-branch 2>&1 | slurp
    # Get the merge commit SHA from base branch
    var merge-commit = (str:trim-space (git -C $project-root rev-parse $base-branch | slurp))
    ui:success "PR merged (commit: "$merge-commit")"
    put $merge-commit
  } catch e {
    ui:error "Failed to merge PR: "(to-string $e[reason])
    put ""
  }
}

# Push changes to remote
fn push-changes {|branch-name|
  ui:dim "Pushing refinement changes..."
  try {
    git -C $project-root push origin $branch-name 2>&1 | slurp
    ui:success "Changes pushed"
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
  var refinements = []
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
        update $branch-name $story-id $refinements
        ui:success "PR updated: "$pr-url
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
