# Plan: Final Human Gate & Release Workflow for Ralph

## Summary

Add a release workflow to Ralph that triggers when all stories in a version complete, provides a final human approval gate, then handles git tagging and merging dev → main.

## Current State

- Ralph exits with "ALL STORIES COMPLETE!" when done (lines 254-258, 658-666 in ralph.elv)
- No release automation exists
- PRD has `target_version` field on stories
- Branching: feature → dev → main
- PR flow exists in pr.elv (can reuse pattern)

## Implementation

### 1. New CLI Flags (lib/cli.elv)

```
--skip-release        Skip release prompt when all stories complete
--auto-release        Auto-approve release (no human gate)
--release-tag <tag>   Custom tag name (default: version from PRD)
```

### 2. New Release Module (lib/release.elv)

Create new module with functions:

```elvish
# Initialize with project paths
fn init {|project-root base-branch|}

# Show what's being released
fn show-summary {|version|}
  # - Stories completed (grouped by epic)
  # - Commit count since dev diverged from main
  # - Files changed stats

# Human approval gate
fn prompt-approval {|}
  # [Y]es release / [n]o cancel / [e]dit tag / [f]eedback
  # Returns: [&action=string &tag=string &feedback=string]

# Run hotfix directly (not a story)
fn run-hotfix {|version feedback|}
  # Creates hotfix branch from dev
  # Runs Claude with feedback as prompt
  # Claude makes fix, commits, pushes
  # Merges hotfix to dev
  # Returns success/failure

# Create annotated git tag
fn create-tag {|tag-name message|}

# Push tag to remote
fn push-tag {|tag-name|}

# Create PR from dev → main
fn create-release-pr {|version tag|}

# Merge the release PR (squash)
fn merge-release-pr {|pr-number|}

# Update prd.json with release info
fn mark-released {|version tag commit|}

# Orchestrate full flow
fn run {|version config|}
```

### 3. PRD Schema Extensions (lib/prd.elv)

Add to prd.json structure:
```json
{
  "version": "v1.0",
  "released": false,
  "released_at": null,
  "release_tag": null,
  "release_commit": null,
  "stories": [...]
}
```

New functions:
```elvish
fn mark-version-released {|version tag commit|}
fn is-version-released {|version|}
fn get-version-stories {|version|}  # For release summary
```

### 4. Main Loop Integration (ralph.elv)

After all-stories-complete detection (around line 658):

```elvish
if (and (prd:all-stories-complete) (not $config[skip-release])) {
  echo ""
  ui:box "ALL STORIES COMPLETE - READY FOR RELEASE" "success"

  # Show what's being released
  release:show-summary $active-version

  # Human gate (unless --auto-release)
  if (not $config[auto-release]) {
    var approval = (release:prompt-approval)

    if (eq $approval[action] "feedback") {
      # Run hotfix directly (not a PRD story)
      ui:status "Running hotfix for release feedback..."
      var hotfix-result = (release:run-hotfix $active-version $approval[feedback])
      if $hotfix-result[success] {
        ui:success "Hotfix merged to dev"
        # Loop back to release prompt
        continue
      } else {
        ui:error "Hotfix failed: "$hotfix-result[error]
        exit 1
      }
    }

    if (eq $approval[action] "cancel") {
      ui:dim "Release cancelled. Run again when ready."
      exit 0
    }

    set release-tag = $approval[tag]
  }

  # Execute release
  var result = (release:run $active-version [
    &tag=$release-tag
    &base=$config[base-branch]
  ])

  if $result[success] {
    ui:success "Released "$active-version" as "$result[tag]
  } else {
    ui:error "Release failed: "$result[error]
    exit 1
  }
}
```

### 5. Release Flow Steps

```
1. Show release summary (stories, commits, files)
2. Human approval prompt (Y/n/e/f)
   - [Y]es - proceed with release
   - [n]o - cancel release
   - [e]dit tag - change tag name
   - [f]eedback - run hotfix and loop back

3. If feedback:
   - Open editor for feedback description
   - Create hotfix branch from dev (e.g., `hotfix/release-v1.0`)
   - Run Claude directly with feedback (NOT a story)
   - Claude makes fix, commits to hotfix branch
   - Merge hotfix → dev
   - Delete hotfix branch
   - Loop back to step 1 (release prompt)

4. If approved:
   a. Create PR: dev → main
      - Title: "Release v1.0"
      - Body: Auto-generated from completed stories
   b. Merge PR (squash merge) → returns merge commit SHA
   c. Checkout main, pull latest
   d. Create annotated tag ON MAIN at merge commit
      - `git tag -a v1.0 -m "Release v1.0" <merge-commit>`
   e. Push tag to remote
      - `git push origin v1.0`
   f. Checkout back to dev
   g. Update prd.json (released=true, tag, commit, timestamp)
   h. Success message
```

### 6. Help Text Update (lib/ui.elv)

Add to show-help:
```
RELEASE OPTIONS:
  --skip-release        Skip release when all stories complete
  --auto-release        Release without human approval
  --release-tag <tag>   Custom tag (default: PRD version)
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `lib/release.elv` | CREATE | New release module |
| `lib/cli.elv` | MODIFY | Add release flags |
| `lib/prd.elv` | MODIFY | Add version release tracking |
| `ralph.elv` | MODIFY | Integrate release flow |
| `lib/ui.elv` | MODIFY | Add help text |

## Example Output

```
╔════════════════════════════════════════════════════════╗
║  ALL STORIES COMPLETE - READY FOR RELEASE v1.0        ║
╚════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════
  RELEASE SUMMARY
═══════════════════════════════════════════════════════

Version: v1.0
Stories: 86 completed
Commits: 142 (dev ahead of main)
Files:   347 changed (+12,456 / -1,234)

───────────────────────────────────────────────────────
Release tag: v1.0

[Y]es release  [n]o cancel  [e]dit tag  [f]eedback
> y

► Creating release PR (dev → main)...
✓ PR #200 created

► Merging to main...
✓ Merged (commit: abc123)

► Checking out main...
✓ On branch main

► Creating tag v1.0 on main...
✓ Tag v1.0 created at abc123

► Pushing tag to origin...
✓ Tag pushed

► Returning to dev...
✓ On branch dev

► Updating PRD...
✓ v1.0 marked as released

╔════════════════════════════════════════════════════════╗
║  RELEASED: v1.0                                       ║
╚════════════════════════════════════════════════════════╝
```

### Feedback Flow Example

```
[Y]es release  [n]o cancel  [e]dit tag  [f]eedback
> f

# Editor opens with template:
# Release Feedback for v1.0
# Describe what needs to be fixed before release:

The login button doesn't work on mobile Safari.
Need to test and fix iOS compatibility.

# Save and close editor

► Running hotfix for release feedback...
► Creating branch hotfix/release-v1.0...
✓ Branch created

► Running Claude with feedback...
  (Claude analyzes and fixes the issue)
✓ Fix committed: "fix: iOS Safari login button compatibility"

► Creating PR: hotfix/release-v1.0 → dev...
✓ PR #201 created and merged

► Cleaning up hotfix branch...
✓ Branch deleted

► Hotfix complete, returning to release prompt...

╔════════════════════════════════════════════════════════╗
║  ALL STORIES COMPLETE - READY FOR RELEASE v1.0        ║
╚════════════════════════════════════════════════════════╝

# Back to release prompt (hotfix now in dev)
```

## Verification

1. Run Ralph on a test project until all stories complete
2. Verify release summary shows correct info
3. Test human gate (Y/n/e/f options)
4. Verify PR created to main with correct title/body
5. Verify tag created on main and pushed
6. Verify prd.json updated with release info
7. Test --skip-release skips the flow
8. Test --auto-release bypasses human gate
9. Test feedback flow creates hotfix and loops back
