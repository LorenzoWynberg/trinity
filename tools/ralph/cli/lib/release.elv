# Release workflow for Ralph
# Handles final human gate and release to main

use str
use re
use path
use ./ui
use ./prd

# Configuration (set by init)
var project-root = ""
var base-branch = "dev"
var main-branch = "main"
var claude-timeout = 1800

# Initialize module
fn init {|root base main timeout|
  set project-root = $root
  set base-branch = $base
  set main-branch = $main
  set claude-timeout = $timeout
}

# Get commit count between dev and main
fn get-commit-count {
  var count = 0
  try {
    set count = (git -C $project-root rev-list --count $main-branch".."$base-branch 2>/dev/null)
  } catch _ { }
  put $count
}

# Get files changed stats between dev and main
fn get-files-stats {
  var stats = ""
  try {
    set stats = (git -C $project-root diff --stat $main-branch".."$base-branch 2>/dev/null | tail -1 | slurp)
  } catch _ { }
  put (str:trim-space $stats)
}

# Show release summary
fn show-summary {|version|
  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  RELEASE SUMMARY"
  echo "═══════════════════════════════════════════════════════"
  echo ""
  echo "Version: "$version

  # Get story count
  var story-count = (prd:get-story-count)
  echo "Stories: "$story-count" completed"

  # Get commit count
  var commit-count = (get-commit-count)
  echo "Commits: "$commit-count" ("$base-branch" ahead of "$main-branch")"

  # Get files stats
  var files-stats = (get-files-stats)
  if (not (eq $files-stats "")) {
    echo "Files:   "$files-stats
  }

  echo ""
  echo "───────────────────────────────────────────────────────"
}

# Prompt for release approval
# Returns map: [&action=string &tag=string &feedback=string]
fn prompt-approval {|default-tag|
  echo "Release tag: "$default-tag" (press 'e' to edit)"
  echo ""
  echo "[Y]es release  [n]o cancel  [e]dit tag  [f]eedback"

  var tag = $default-tag

  while $true {
    print "> "
    var input = ""
    try {
      set input = (head -n1 < /dev/tty | str:trim-space)
    } catch _ {
      set input = "n"
    }

    var lower = (str:to-lower $input)

    if (or (eq $lower "y") (eq $lower "yes") (eq $lower "")) {
      put [&action=approve &tag=$tag &feedback=""]
      return
    } elif (or (eq $lower "n") (eq $lower "no")) {
      put [&action=cancel &tag=$tag &feedback=""]
      return
    } elif (eq $lower "e") {
      print "Enter new tag: "
      var new-tag = ""
      try {
        set new-tag = (head -n1 < /dev/tty | str:trim-space)
      } catch _ { }
      if (not (eq $new-tag "")) {
        set tag = $new-tag
        echo "Tag updated to: "$tag
      }
    } elif (eq $lower "f") {
      # Open editor for feedback
      var tmp = (mktemp)
      echo "# Release Feedback for "$tag > $tmp
      echo "# Describe what needs to be fixed before release:" >> $tmp
      echo "# (Lines starting with # are ignored)" >> $tmp
      echo "" >> $tmp

      var editor = "vim"
      if (has-env EDITOR) {
        set editor = $E:EDITOR
      } elif (has-env VISUAL) {
        set editor = $E:VISUAL
      }

      # Open editor
      try {
        (external $editor) $tmp < /dev/tty > /dev/tty 2>&1
      } catch e {
        ui:error "Failed to open editor: "(to-string $e[reason])
        rm -f $tmp
        continue
      }

      # Read feedback (excluding comments and empty lines)
      var feedback = ""
      try {
        set feedback = (cat $tmp | grep -v '^#' | grep -v '^$' | slurp)
      } catch _ { }
      rm -f $tmp

      set feedback = (str:trim-space $feedback)
      if (eq $feedback "") {
        echo "No feedback provided, continuing..."
        continue
      }

      put [&action=feedback &tag=$tag &feedback=$feedback]
      return
    } else {
      echo "Invalid option. Use Y/n/e/f"
    }
  }
}

# Run hotfix directly (not a story)
fn run-hotfix {|version feedback|
  var hotfix-branch = "hotfix/release-"$version

  ui:status "Creating branch "$hotfix-branch"..."

  # Create hotfix branch from dev
  try {
    git -C $project-root checkout -b $hotfix-branch $base-branch 2>/dev/null
  } catch e {
    put [&success=$false &error="Failed to create hotfix branch: "(to-string $e[reason])]
    return
  }
  ui:success "Branch created"

  # Build prompt for Claude
  var prompt = "You are fixing a pre-release issue for "$version".

FEEDBACK FROM RELEASE REVIEW:
"$feedback"

INSTRUCTIONS:
1. Analyze the feedback and understand what needs to be fixed
2. Make the necessary code changes to address the feedback
3. Keep changes minimal and focused on the feedback
4. Commit your changes with a descriptive message starting with 'fix:'

Do NOT create a new story or update PRD. Just fix the issue directly.
After making changes, commit and output: <hotfix-complete/>"

  ui:status "Running Claude with feedback..."

  # Run Claude
  var claude-output = ""
  try {
    set claude-output = (echo $prompt | claude --dangerously-skip-permissions --print --output-format stream-json 2>&1 | slurp)
  } catch e {
    # Checkout back to base branch
    git -C $project-root checkout $base-branch 2>/dev/null
    git -C $project-root branch -D $hotfix-branch 2>/dev/null
    put [&success=$false &error="Claude failed: "(to-string $e[reason])]
    return
  }

  # Check for hotfix-complete signal
  if (not (str:contains $claude-output "<hotfix-complete/>")) {
    ui:warn "Claude did not signal completion, checking for changes..."
  }

  # Check if there are any changes to commit
  var has-changes = $false
  try {
    var status = (git -C $project-root status --porcelain 2>/dev/null | slurp)
    if (not (eq (str:trim-space $status) "")) {
      set has-changes = $true
    }
  } catch _ { }

  if (not $has-changes) {
    # Check if there are committed changes
    var commit-count = 0
    try {
      set commit-count = (git -C $project-root rev-list --count $base-branch".."$hotfix-branch 2>/dev/null)
    } catch _ { }

    if (== $commit-count 0) {
      git -C $project-root checkout $base-branch 2>/dev/null
      git -C $project-root branch -D $hotfix-branch 2>/dev/null
      put [&success=$false &error="No changes made by Claude"]
      return
    }
  } else {
    # Commit any uncommitted changes
    try {
      git -C $project-root add -A
      git -C $project-root commit -m "fix: address release feedback for "$version
    } catch _ { }
  }

  ui:success "Fix committed"

  # Push hotfix branch
  ui:status "Pushing hotfix branch..."
  try {
    git -C $project-root push -u origin $hotfix-branch 2>/dev/null
  } catch e {
    git -C $project-root checkout $base-branch 2>/dev/null
    git -C $project-root branch -D $hotfix-branch 2>/dev/null
    put [&success=$false &error="Failed to push hotfix branch: "(to-string $e[reason])]
    return
  }

  # Create PR to dev
  ui:status "Creating PR: "$hotfix-branch" → "$base-branch"..."
  var pr-url = ""
  try {
    set pr-url = (gh pr create --base $base-branch --head $hotfix-branch --title "fix: release feedback for "$version --body "Fixes pre-release feedback:

"$feedback 2>/dev/null | slurp)
  } catch e {
    put [&success=$false &error="Failed to create PR: "(to-string $e[reason])]
    return
  }
  ui:success "PR created"

  # Merge PR
  ui:status "Merging hotfix PR..."
  try {
    gh pr merge $hotfix-branch --squash --delete-branch 2>/dev/null
  } catch e {
    put [&success=$false &error="Failed to merge PR: "(to-string $e[reason])]
    return
  }
  ui:success "PR merged"

  # Checkout back to dev and pull
  ui:status "Returning to "$base-branch"..."
  try {
    git -C $project-root checkout $base-branch 2>/dev/null
    git -C $project-root pull origin $base-branch 2>/dev/null
  } catch _ { }
  ui:success "On branch "$base-branch

  put [&success=$true &error=""]
}

# Create release PR from dev to main
fn create-release-pr {|version stories-summary|
  ui:status "Creating release PR ("$base-branch" → "$main-branch")..."

  var title = "Release "$version
  var body = "## Release "$version"

### Stories Completed
"$stories-summary"

### Stats
- Commits: "(get-commit-count)"
- "(get-files-stats)

  var pr-url = ""
  try {
    set pr-url = (gh pr create --base $main-branch --head $base-branch --title $title --body $body 2>/dev/null | str:trim-space)
  } catch e {
    put [&success=$false &url="" &error="Failed to create PR: "(to-string $e[reason])]
    return
  }

  ui:success "PR created: "$pr-url
  put [&success=$true &url=$pr-url &error=""]
}

# Merge release PR
fn merge-release-pr {
  ui:status "Merging release PR..."

  var merge-commit = ""
  try {
    gh pr merge $base-branch --merge 2>/dev/null
    # Get the merge commit SHA
    set merge-commit = (git -C $project-root rev-parse $main-branch 2>/dev/null | str:trim-space)
  } catch e {
    put [&success=$false &commit="" &error="Failed to merge PR: "(to-string $e[reason])]
    return
  }

  ui:success "Merged (commit: "$merge-commit")"
  put [&success=$true &commit=$merge-commit &error=""]
}

# Create tag on main
fn create-tag {|tag-name commit message|
  ui:status "Checking out "$main-branch"..."
  try {
    git -C $project-root checkout $main-branch 2>/dev/null
    git -C $project-root pull origin $main-branch 2>/dev/null
  } catch e {
    put [&success=$false &error="Failed to checkout main: "(to-string $e[reason])]
    return
  }
  ui:success "On branch "$main-branch

  ui:status "Creating tag "$tag-name" on "$main-branch"..."
  try {
    git -C $project-root tag -a $tag-name -m $message 2>/dev/null
  } catch e {
    put [&success=$false &error="Failed to create tag: "(to-string $e[reason])]
    return
  }
  ui:success "Tag "$tag-name" created"

  put [&success=$true &error=""]
}

# Push tag to remote
fn push-tag {|tag-name|
  ui:status "Pushing tag to origin..."
  try {
    git -C $project-root push origin $tag-name 2>/dev/null
  } catch e {
    put [&success=$false &error="Failed to push tag: "(to-string $e[reason])]
    return
  }
  ui:success "Tag pushed"
  put [&success=$true &error=""]
}

# Return to dev branch
fn return-to-dev {
  ui:status "Returning to "$base-branch"..."
  try {
    git -C $project-root checkout $base-branch 2>/dev/null
  } catch _ { }
  ui:success "On branch "$base-branch
}

# Run full release flow
fn run {|version tag|
  # Get stories summary for PR
  var stories-summary = (prd:get-stories-summary)

  # Create release PR
  var pr-result = (create-release-pr $version $stories-summary)
  if (not $pr-result[success]) {
    put [&success=$false &tag="" &error=$pr-result[error]]
    return
  }

  # Merge PR
  var merge-result = (merge-release-pr)
  if (not $merge-result[success]) {
    put [&success=$false &tag="" &error=$merge-result[error]]
    return
  }

  # Create tag on main
  var tag-result = (create-tag $tag $merge-result[commit] "Release "$tag)
  if (not $tag-result[success]) {
    return-to-dev
    put [&success=$false &tag="" &error=$tag-result[error]]
    return
  }

  # Push tag
  var push-result = (push-tag $tag)
  if (not $push-result[success]) {
    return-to-dev
    put [&success=$false &tag="" &error=$push-result[error]]
    return
  }

  # Return to dev
  return-to-dev

  # Mark version as released in PRD
  prd:mark-version-released $version $tag $merge-result[commit]
  ui:success $version" marked as released"

  put [&success=$true &tag=$tag &error=""]
}

# Run full release flow with prompts and hotfix loop
# Returns: [&released=bool &tag=string]
fn run-full-flow {|version &skip-release=$false &auto-release=$false &notify-enabled=$false|
  # Skip release flow if requested
  if $skip-release {
    ui:dim "Release skipped (--skip-release)"
    put [&released=$false &tag=""]
    return
  }

  # Check if already released
  if (prd:is-version-released $version) {
    ui:success $version" already released!"
    put [&released=$true &tag=$version]
    return
  }

  # Determine release tag
  var release-tag = $version

  while $true {
    # Show summary
    show-summary $version

    # Human gate (unless --auto-release)
    if $auto-release {
      ui:dim "Auto-release enabled, proceeding..."
    } else {
      var approval = (prompt-approval $release-tag)

      if (eq $approval[action] "cancel") {
        ui:dim "Release cancelled. Run again when ready."
        put [&released=$false &tag=""]
        return
      }

      if (eq $approval[action] "feedback") {
        # Run hotfix directly (not a PRD story)
        ui:status "Running hotfix for release feedback..."
        var hotfix-result = (run-hotfix $version $approval[feedback])
        if $hotfix-result[success] {
          ui:success "Hotfix merged to dev"
          echo ""
          ui:box "RELEASE GATE - Try Again" "info"
          # Loop back to release prompt
          continue
        } else {
          ui:error "Hotfix failed: "$hotfix-result[error]
          put [&released=$false &tag="" &error=$hotfix-result[error]]
          return
        }
      }

      # Update tag if edited
      set release-tag = $approval[tag]
    }

    # Execute release
    var result = (run $version $release-tag)

    if $result[success] {
      echo ""
      ui:box "RELEASED: "$version" ("$result[tag]")" "success"
      if $notify-enabled {
        ui:notify "Ralph" "Released "$version" as "$result[tag]
      }
      put [&released=$true &tag=$result[tag]]
      return
    } else {
      ui:error "Release failed: "$result[error]
      put [&released=$false &tag="" &error=$result[error]]
      return
    }
  }
}
