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

# Track feedback history for PR updates
var feedback-history = []

# Initialize module
fn init {|root branch apr amerge|
  set project-root = $root
  set base-branch = $branch
  set auto-pr = $apr
  set auto-merge = $amerge
  set feedback-history = []
}

# Generate or update PR description using Claude
# Checks current PR body and decides if update is needed
fn generate-pr-body {|story-id story-title branch-name|
  # Use echo directly to /dev/tty to avoid capture issues
  echo "\e[2m  Generating PR description with Claude...\e[0m" > /dev/tty

  # Get current PR body if it exists
  var current-body = ""
  try {
    set current-body = (gh pr view $branch-name --json body -q '.body' 2>/dev/null | slurp)
  } catch _ { }

  # Get commits for this branch
  var commits = ""
  try {
    set commits = (git -C $project-root log --oneline $base-branch".."$branch-name 2>/dev/null | slurp)
  } catch _ { }

  # Get file stats
  var stats = ""
  try {
    set stats = (git -C $project-root diff --stat $base-branch".."$branch-name 2>/dev/null | slurp)
  } catch _ { }

  # Get files changed list
  var files-changed = ""
  try {
    set files-changed = (git -C $project-root diff --name-status $base-branch".."$branch-name 2>/dev/null | slurp)
  } catch _ { }

  # Get acceptance criteria from prd.json
  var acceptance = ""
  try {
    set acceptance = (jq -r ".stories[] | select(.id == \""$story-id"\") | .acceptance | join(\"\n- \")" (prd:get-prd-file) 2>/dev/null | slurp)
    if (not (eq $acceptance "")) {
      set acceptance = "- "$acceptance
    }
  } catch _ { }

  # Build feedback section if we have history
  var feedback-section = ""
  if (> (count $feedback-history) 0) {
    set feedback-section = "FEEDBACK APPLIED IN THIS PR:\n"
    var round = 0
    for fb $feedback-history {
      set round = (+ $round 1)
      set feedback-section = $feedback-section"- Round "$round": "$fb"\n"
    }
  }

  # Build the prompt - Claude decides if update is needed
  var prompt = "You are reviewing a GitHub PR to ensure its description is complete and accurate.

STORY: "$story-id" - "$story-title"

ACCEPTANCE CRITERIA:
"$acceptance"

ALL COMMITS IN THIS PR:
"$commits"

FILES CHANGED:
"$files-changed"

DIFF STATS:
"$stats"
"
  if (not (eq $feedback-section "")) {
    set prompt = $prompt"
"$feedback-section"
"
  }

  if (not (eq (str:trim-space $current-body) "")) {
    set prompt = $prompt"
CURRENT PR DESCRIPTION:
"$current-body"

TASK: Review the current PR description against the commits and changes above.
- If the description already accurately covers ALL commits and changes, output: DESCRIPTION_COMPLETE
- If the description is missing information or needs updating (e.g., new commits from feedback), output an updated description.
"
  } else {
    set prompt = $prompt"
CURRENT PR DESCRIPTION: (none - new PR)

TASK: Write a complete PR description for this story.
"
  }

  set prompt = $prompt"
Format for new/updated descriptions (markdown):
## Summary
<2-3 sentences: what this PR accomplishes overall>

## Changes
<bullet points covering ALL significant changes from the commits>
"
  if (not (eq $feedback-section "")) {
    set prompt = $prompt"
## Feedback Addressed
<bullet points: what feedback was given and how it was addressed>
"
  }
  set prompt = $prompt"
## Testing
<how to verify: commands to run, what to check>

Output ONLY 'DESCRIPTION_COMPLETE' or the full updated description. No other text."

  # Call Claude
  var result = ""
  try {
    set result = (echo $prompt | claude --dangerously-skip-permissions --print 2>/dev/null | slurp)
  } catch _ { }

  # Check if Claude says it's already complete
  if (str:contains $result "DESCRIPTION_COMPLETE") {
    echo "\e[2m  PR description is already complete\e[0m" > /dev/tty
    put $current-body
    return
  }

  # If we got a result, use it
  if (not (eq (str:trim-space $result) "")) {
    echo "\e[32m\e[1m✓ \e[0m\e[32mPR description generated\e[0m" > /dev/tty
    put $result
    return
  }

  # Fallback if Claude fails
  echo "\e[2m  Claude unavailable, using basic template\e[0m" > /dev/tty
  put "## "$story-id": "$story-title"

### Commits
```
"$commits"
```

### Changes
"$stats
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

# Create a new PR with Claude-generated description
fn create {|branch-name story-id story-title|
  echo "\e[34m► \e[0mCreating PR to "$base-branch"..." > /dev/tty

  var body = (generate-pr-body $story-id $story-title $branch-name)

  try {
    var url = (gh pr create --base $base-branch --head $branch-name --title $story-id": "$story-title --body $body 2>&1 | slurp)
    set url = (str:trim-space $url)
    echo "\e[32m\e[1m✓ \e[0m\e[32mPR created: "$url"\e[0m" > /dev/tty
    put $url
  } catch e {
    echo "\e[31m\e[1m✗ \e[0mFailed to create PR: "(to-string $e[reason]) > /dev/tty
    put ""
  }
}

# Update PR description - Claude checks if update is needed
fn update {|branch-name story-id story-title|
  echo "\e[34m► \e[0mChecking PR description..." > /dev/tty

  var body = (generate-pr-body $story-id $story-title $branch-name)

  # Get current body to compare
  var current-body = ""
  try {
    set current-body = (gh pr view $branch-name --json body -q '.body' 2>/dev/null | slurp)
  } catch _ { }

  # If body is same as current, no update needed
  if (eq $body $current-body) {
    echo "\e[2m  No update needed\e[0m" > /dev/tty
    put $true
    return
  }

  try {
    gh pr edit $branch-name --body $body 2>&1 > /dev/null
    put $true
  } catch e {
    echo "\e[31m\e[1m✗ \e[0mFailed to update PR: "(to-string $e[reason]) > /dev/tty
    put $false
  }
}

# Add feedback to history (called before re-running Claude)
fn add-feedback-to-history {|fb|
  set feedback-history = [$@feedback-history $fb]
}

# Post feedback as PR comment (visible on GitHub)
fn post-feedback-comment {|branch-name feedback|
  ui:dim "  Posting feedback to PR..." > /dev/tty
  try {
    gh pr comment $branch-name --body '**Feedback Requested:**

'$feedback 2>&1 | slurp
    ui:success "  Feedback posted to PR" > /dev/tty
    put $true
  } catch e {
    ui:warn "  Failed to post comment: "(to-string $e[reason]) > /dev/tty
    put $false
  }
}

# Post resolution comment after Claude fixes (visible on GitHub)
fn post-resolution-comment {|branch-name summary|
  ui:dim "  Posting resolution to PR..." > /dev/tty
  try {
    gh pr comment $branch-name --body '**Changes Applied:**

'$summary 2>&1 | slurp
    ui:success "  Resolution posted to PR" > /dev/tty
    put $true
  } catch e {
    ui:warn "  Failed to post comment: "(to-string $e[reason]) > /dev/tty
    put $false
  }
}

# Get all PR comments (for context)
fn get-all-pr-comments {|branch-name|
  try {
    var comments = (gh pr view $branch-name --json comments,reviews --jq '[.comments[].body, .reviews[].body] | map(select(. != null)) | join("\n\n---\n\n")' 2>/dev/null | slurp)
    put $comments
  } catch _ {
    put ""
  }
}

# Clear feedback history (called after merge)
fn clear-feedback-history {
  set feedback-history = []
}

# Merge PR - returns merge commit SHA or empty string on failure
fn merge {|branch-name|
  # Use echo directly to /dev/tty to avoid capture issues
  echo "\e[34m► \e[0mMerging PR..." > /dev/tty
  try {
    gh pr merge $branch-name --squash --delete-branch 2>&1 > /dev/null
    # Get the merge commit SHA from base branch
    var merge-commit = (str:trim-space (git -C $project-root rev-parse $base-branch | slurp))
    echo "\e[32m\e[1m✓ \e[0m\e[32mPR merged (commit: "$merge-commit")\e[0m" > /dev/tty
    put $merge-commit
  } catch e {
    echo "\e[31m\e[1m✗ \e[0mFailed to merge PR: "(to-string $e[reason]) > /dev/tty
    put ""
  }
}

# Push changes to remote
fn push-changes {|branch-name|
  echo "\e[2mPushing refinement changes...\e[0m" > /dev/tty
  try {
    git -C $project-root push origin $branch-name 2>&1 > /dev/null
    echo "\e[32m\e[1m✓ \e[0m\e[32mChanges pushed\e[0m" > /dev/tty
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

# Get feedback text from user via editor
fn get-feedback {
  echo "" > /dev/tty

  # Create temp file with instructions
  var tmp = (mktemp --suffix=.md)
  echo "# Enter feedback for Claude" > $tmp
  echo "# Lines starting with # are ignored" >> $tmp
  echo "# Save and close to submit, empty file to cancel" >> $tmp
  echo "" >> $tmp

  # Determine editor (fallback chain)
  var editor = "vim"
  if (has-env EDITOR) {
    set editor = $E:EDITOR
  } elif (has-env VISUAL) {
    set editor = $E:VISUAL
  }

  ui:status "Opening editor for feedback..." > /dev/tty
  ui:dim "  Using: "$editor > /dev/tty

  # Open editor
  try {
    (external $editor) $tmp </dev/tty >/dev/tty 2>/dev/tty
  } catch e {
    ui:error "Failed to open editor: "(to-string $e[reason]) > /dev/tty
    rm -f $tmp
    put ""
    return
  }

  # Parse result, ignoring comment lines
  var content = ""
  try {
    set content = (cat $tmp | grep -v '^#' | str:trim-space (slurp))
  } catch _ { }

  rm -f $tmp

  if (eq $content "") {
    ui:dim "No feedback provided (empty or cancelled)" > /dev/tty
  }

  put $content
}

# Get the stored feedback
fn get-stored-feedback {
  put $feedback
}

# Run the full PR and merge flow with feedback loops
# Takes optional state-pr-url to skip PR creation if already exists
# Returns: map with &result and &pr_url
fn run-flow {|story-id branch-name story-title current-iteration &state-pr-url=""|
  var pr-url = $state-pr-url
  var pr-exists = $false
  set feedback = ""  # Reset feedback

  # Check if PR already exists (from state or by checking GitHub)
  if (not (eq $pr-url "")) {
    set pr-exists = $true
    ui:dim "PR already tracked: "$pr-url > /dev/tty
  } else {
    set pr-url = (check-exists $branch-name)
    if (not (eq $pr-url "")) {
      set pr-exists = $true
    }
  }

  # === PR PROMPT (skip if PR already exists from state) ===
  if (and (not $auto-pr) (eq $state-pr-url "")) {
    if $pr-exists {
      ui:status "PR exists: "$pr-url > /dev/tty
      ui:status "Update PR?" > /dev/tty
    } else {
      ui:status "Create PR to "$base-branch"?" > /dev/tty
    }
    echo "\e[33m[Y]es / [n]o\e[0m" > /dev/tty

    var answer = (prompt-user 0)
    if (re:match '^[nN]$' $answer) {
      ui:dim "Skipping PR (branch pushed: "$branch-name")" > /dev/tty
      put [&result="skipped" &pr_url=""]
      return
    }
  }

  # Handle PR create (don't update description here - save for merge)
  if (not $pr-exists) {
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
      # Update PR description before merge (includes all feedback rounds)
      update $branch-name $story-id $story-title
      var commit = (merge $branch-name)
      if (not (eq $commit "")) {
        prd:mark-merged $story-id $commit
        clear-feedback-history  # Clear on successful merge
      }
      put [&result="merged" &pr_url=""]
    } elif (re:match '^[fF]$' $answer) {
      set feedback = (get-feedback)
      if (not (eq $feedback "")) {
        add-feedback-to-history $feedback  # Track feedback for PR updates
        # Post feedback as PR comment (visible on GitHub)
        post-feedback-comment $branch-name $feedback
        ui:status "Feedback received. Will re-run Claude with changes..." > /dev/tty
        put [&result="feedback" &pr_url=$pr-url]
      } else {
        ui:dim "No feedback provided, leaving PR open" > /dev/tty
        put [&result="open" &pr_url=$pr-url]
      }
    } else {
      # Default to no (leave open for review)
      ui:dim "PR left open for review" > /dev/tty
      put [&result="open" &pr_url=$pr-url]
    }
  } elif $auto-merge {
    # Update PR description before merge
    update $branch-name $story-id $story-title
    var commit = (merge $branch-name)
    if (not (eq $commit "")) {
      prd:mark-merged $story-id $commit
      clear-feedback-history  # Clear on successful merge
    }
    put [&result="merged" &pr_url=""]
  } else {
    put [&result="open" &pr_url=$pr-url]
  }
}
