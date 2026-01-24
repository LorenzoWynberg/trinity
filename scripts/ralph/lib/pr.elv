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
  ui:status "Creating PR to "$base-branch"..." > /dev/tty
  try {
    var url = (gh pr create --base $base-branch --head $branch-name --title $story-id": "$story-title --body "Automated PR for "$story-id 2>&1 | slurp)
    set url = (str:trim-space $url)
    ui:success "PR created: "$url > /dev/tty
    put $url
  } catch e {
    ui:error "Failed to create PR: "(to-string $e[reason]) > /dev/tty
    put ""
  }
}

# Update PR description
fn update {|branch-name story-id refinements|
  ui:status "Updating PR description..." > /dev/tty
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
  if (not $auto-pr) {
    if $pr-exists {
      ui:status "PR exists: "$pr-url > /dev/tty
      ui:status "Create/update PR?" > /dev/tty
    } else {
      ui:status "Create PR to "$base-branch"?" > /dev/tty
    }
    echo "\e[33m[Y]es / [n]o\e[0m" > /dev/tty

    var answer = (prompt-user 0)
    if (re:match '^[nN]$' $answer) {
      ui:dim "Skipping PR (branch pushed: "$branch-name")" > /dev/tty
      put "skipped"
      return
    }
  }

  # Handle PR create/update
  if $pr-exists {
    update $branch-name $story-id []
    ui:success "PR updated: "$pr-url > /dev/tty
  } else {
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
