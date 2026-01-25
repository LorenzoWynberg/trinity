# PRD and story operations for Ralph

use str
use path
use re
use ./ui

# PRD directory and current file path
var prd-dir = ""
var prd-file = ""

# Initialize with PRD directory path
fn init {|dir-path|
  set prd-dir = $dir-path
}

# Set current PRD file (called after version selection)
fn set-prd-file {|file-path|
  set prd-file = $file-path
}

# Current selected version
var current-version = ""

# Get PRD file path (for other modules)
fn get-prd-file {
  put $prd-file
}

# Get PRD directory path
fn get-prd-dir {
  put $prd-dir
}

# Get current selected version
fn get-current-version {
  put $current-version
}

# List all available version files in prd directory
fn list-versions {
  var versions = []
  try {
    var files = [(ls $prd-dir 2>/dev/null | grep -E '^v[0-9]+\.[0-9]+\.json$')]
    for file $files {
      var version = (re:replace '\.json$' '' $file)
      set versions = [$@versions $version]
    }
  } catch _ { }
  # Sort versions (simple string sort works for vX.Y format)
  put $@versions | order
}

# Get PRD file path for a specific version
fn get-version-file {|version|
  put $prd-dir"/"$version".json"
}

# Check if a version has incomplete stories
fn version-has-incomplete {|version|
  var file = (get-version-file $version)
  if (not (path:is-regular $file)) {
    put $false
    return
  }
  var incomplete = (jq '[.stories[] | select(.merged != true)] | length' $file)
  not (eq $incomplete "0")
}

# Get the lowest semantic version that has incomplete stories
fn get-active-version {
  var versions = [(list-versions)]
  for ver $versions {
    if (version-has-incomplete $ver) {
      put $ver
      return
    }
  }
  # All versions complete, return empty
  put ""
}

# Select and set the PRD file (auto or by flag)
fn select-version {|target-version|
  var version = ""

  if (not (eq $target-version "")) {
    # Use specified version
    set version = $target-version
  } else {
    # Auto-select lowest incomplete version
    set version = (get-active-version)
  }

  if (eq $version "") {
    put ""
    return
  }

  var file = (get-version-file $version)
  if (not (path:is-regular $file)) {
    put ""
    return
  }

  set-prd-file $file
  set current-version = $version
  put $version
}

# Get story info for branch naming (phase, epic, story_number)
fn get-story-info {|story-id|
  var query = ".stories[] | select(.id == \""$story-id"\") | \"\\(.phase)\\t\\(.epic)\\t\\(.story_number)\""
  jq -r $query $prd-file
}

# Get story title
fn get-story-title {|story-id|
  jq -r ".stories[] | select(.id == \""$story-id"\") | .title" $prd-file
}

# Build branch name from story ID
fn get-branch-name {|story-id|
  var info = (try { str:trim-space (get-story-info $story-id | slurp) } catch _ { put "" })
  if (eq $info "") {
    fail "Story "$story-id" not found in PRD"
  }
  var parts = [(str:split "\t" $info)]
  if (< (count $parts) 3) {
    fail "Invalid story info format for "$story-id
  }
  put "feat/story-"$parts[0]"."$parts[1]"."$parts[2]
}

# ═══════════════════════════════════════════════════════════════════════════
# DEPENDENCY CHECKING (supports cross-version)
# ═══════════════════════════════════════════════════════════════════════════
#
# Dependency syntax:
#   STORY-X.Y.Z         → specific story in current version
#   X                   → whole phase X in current version
#   X:Y                 → phase X, epic Y in current version
#   vN.N:STORY-X.Y.Z    → specific story in version N.N
#   vN.N:X              → whole phase X in version N.N
#   vN.N:X:Y            → phase X, epic Y in version N.N
#   vN.N                → entire version N.N
# ═══════════════════════════════════════════════════════════════════════════

# Check if a single dependency is met (all matching stories merged)
fn check-dep-met {|dep|
  var version = $current-version
  var target = $dep
  var file = $prd-file

  # Check for version prefix (e.g., "v1.0:..." or just "v1.0")
  if (re:match '^v[0-9]+\.[0-9]+' $dep) {
    # Extract version
    if (re:match '^v[0-9]+\.[0-9]+:' $dep) {
      # Has target after version (v1.0:something)
      var parts = [(str:split ":" $dep)]
      set version = $parts[0]
      set target = (str:join ":" $parts[1..])
    } else {
      # Just version (v1.0 = entire version must be complete)
      set version = $dep
      set target = ""
    }
    set file = (get-version-file $version)
    if (not (path:is-regular $file)) {
      # Version file doesn't exist - dependency not met
      put $false
      return
    }
  }

  # Now check the target within the file
  if (eq $target "") {
    # Entire version must be complete
    var not-merged = (jq '[.stories[] | select(.merged != true)] | length' $file)
    put (eq $not-merged "0")
  } elif (re:match '^STORY-' $target) {
    # Specific story
    var merged = (jq -r '.stories[] | select(.id == "'$target'") | .merged // false' $file)
    put (eq $merged "true")
  } elif (re:match '^[0-9]+:[0-9]+$' $target) {
    # Phase:Epic (e.g., "1:2")
    var parts = [(str:split ":" $target)]
    var phase = $parts[0]
    var epic = $parts[1]
    var not-merged = (jq '[.stories[] | select(.phase == '$phase' and .epic == '$epic' and .merged != true)] | length' $file)
    put (eq $not-merged "0")
  } elif (re:match '^[0-9]+$' $target) {
    # Just phase (e.g., "1")
    var phase = $target
    var not-merged = (jq '[.stories[] | select(.phase == '$phase' and .merged != true)] | length' $file)
    put (eq $not-merged "0")
  } else {
    # Unknown format - treat as not met
    put $false
  }
}

# Check if all dependencies for a story are met
fn check-all-deps-met {|deps-list|
  for dep $deps-list {
    if (not (check-dep-met $dep)) {
      put $false
      return
    }
  }
  put $true
}

# Get next available story (respects dependencies - deps must be MERGED)
fn get-next-story {
  # Get stories that haven't passed yet (available for work)
  var candidates = [(jq -r '.stories[] | select(.passes != true) | "\(.id)|\(.depends_on // [] | join(","))"' $prd-file)]

  for candidate $candidates {
    var parts = [(str:split "|" $candidate)]
    var sid = $parts[0]
    var deps-str = $parts[1]

    # Check if all dependencies are met
    var deps-met = $true
    if (not (eq $deps-str "")) {
      var deps = [(str:split "," $deps-str)]
      set deps-met = (check-all-deps-met $deps)
    }

    if $deps-met {
      put $sid
      return
    }
  }

  # No story found
  put ""
}

# Check if all stories are merged (truly complete)
fn all-stories-complete {
  var not-merged = (jq '[.stories[] | select(.merged != true)] | length' $prd-file)
  eq $not-merged "0"
}

# Mark a story as passed (Claude completed work)
fn mark-passed {|story-id|
  var tmp = (mktemp)
  jq '(.stories[] | select(.id == "'$story-id'")).passes = true' $prd-file > $tmp
  mv $tmp $prd-file
}

# Mark a story as merged (PR merged to base branch)
fn mark-merged {|story-id merge-commit|
  var tmp = (mktemp)
  jq '(.stories[] | select(.id == "'$story-id'")) |= . + {merged: true, merge_commit: "'$merge-commit'"}' $prd-file > $tmp
  mv $tmp $prd-file
}

# Save PR URL for a story
fn set-pr-url {|story-id pr-url|
  var tmp = (mktemp)
  jq '(.stories[] | select(.id == "'$story-id'")).pr_url = "'$pr-url'"' $prd-file > $tmp
  mv $tmp $prd-file
}

# Check if a story is merged (for dependency checking)
fn is-merged {|story-id|
  var result = (jq -r '.stories[] | select(.id == "'$story-id'") | .merged // false' $prd-file)
  eq $result "true"
}

# Get stories that passed but are not merged (need merge prompt)
fn get-unmerged-passed {
  jq -r '.stories[] | select(.passes == true and .merged != true) | .id' $prd-file
}

# Get stories that are blocked (not passed, deps not met)
# Returns list of [story-id, blocking-dep, ...]
fn get-blocked-stories {
  var blocked = []
  # Get stories that haven't passed yet
  var candidates = [(jq -r '.stories[] | select(.passes != true) | "\(.id)|\(.depends_on // [] | join(","))"' $prd-file)]

  for candidate $candidates {
    var parts = [(str:split "|" $candidate)]
    var sid = $parts[0]
    var deps-str = $parts[1]

    if (not (eq $deps-str "")) {
      var deps = [(str:split "," $deps-str)]
      # Check each dep - find first unmet one
      for dep $deps {
        if (not (check-dep-met $dep)) {
          set blocked = [$@blocked [&story=$sid &blocked_by=$dep]]
          break
        }
      }
    }
  }
  put $@blocked
}

# Get PR URL for a story (if exists)
fn get-pr-url {|story-id|
  var url = (jq -r '.stories[] | select(.id == "'$story-id'") | .pr_url // ""' $prd-file)
  put $url
}

# Check if there are pending stories (not passed, not skipped)
fn has-pending-stories {
  var pending = (jq '[.stories[] | select(.passes != true and .skipped != true)] | length' $prd-file)
  not (eq $pending "0")
}

# Get branch name for a story (for resuming merge)
fn get-story-branch {|story-id|
  var info = (try { str:trim-space (get-story-info $story-id | slurp) } catch _ { put "" })
  if (eq $info "") {
    put ""
    return
  }
  var parts = [(str:split "\t" $info)]
  if (< (count $parts) 3) {
    put ""
    return
  }
  put "feat/story-"$parts[0]"."$parts[1]"."$parts[2]
}

# Reset a story for retry (clears passes, merged, attempts)
fn reset-story {|story-id|
  var tmp = (mktemp)
  jq '(.stories[] | select(.id == "'$story-id'")) |= . + {
    passes: false,
    merged: false,
    skipped: false
  } | del(.stories[] | select(.id == "'$story-id'") | .merge_commit, .skip_reason)' $prd-file > $tmp
  mv $tmp $prd-file
}

# Skip a story (marks as complete for dependency purposes)
fn skip-story {|story-id reason|
  var tmp = (mktemp)
  jq '(.stories[] | select(.id == "'$story-id'")) |= . + {
    skipped: true,
    skip_reason: "'$reason'",
    passes: true,
    merged: true
  }' $prd-file > $tmp
  mv $tmp $prd-file
}

# Get PRD status summary (phase/epic/story hierarchy with progress)
fn show-status {
  # Get totals
  var total = (jq '.stories | length' $prd-file)
  var passed = (jq '[.stories[] | select(.passes == true)] | length' $prd-file)
  var merged = (jq '[.stories[] | select(.merged == true)] | length' $prd-file)
  var skipped = (jq '[.stories[] | select(.skipped == true)] | length' $prd-file)
  var blocked = (jq '[.stories[] | select(.passes != true)] | length' $prd-file)

  # Calculate percentage
  var pct = 0
  if (> $total 0) {
    set pct = (/ (* $merged 100) $total)
  }

  echo "═══════════════════════════════════════════════════════"
  echo "  PRD STATUS"
  echo "═══════════════════════════════════════════════════════"
  echo ""
  echo "Progress: "$merged"/"$total" merged ("$pct"%)"
  echo "  - Passed (awaiting merge): "(- $passed $merged)
  echo "  - Skipped: "$skipped
  echo "  - Remaining: "(- $total $passed)
  echo ""
  echo "───────────────────────────────────────────────────────"
  echo "  STORIES BY PHASE/EPIC"
  echo "───────────────────────────────────────────────────────"
  echo ""

  # Get unique phases
  var phases = [(jq -r '.stories | map(.phase) | unique | .[]' $prd-file)]

  for phase $phases {
    # Phase header
    var phase-total = (jq '[.stories[] | select(.phase == '$phase')] | length' $prd-file)
    var phase-merged = (jq '[.stories[] | select(.phase == '$phase' and .merged == true)] | length' $prd-file)
    echo "Phase "$phase" ["$phase-merged"/"$phase-total"]"

    # Get unique epics in this phase
    var epics = [(jq -r '.stories | map(select(.phase == '$phase') | .epic) | unique | .[]' $prd-file)]

    for epic $epics {
      var epic-total = (jq '[.stories[] | select(.phase == '$phase' and .epic == '$epic')] | length' $prd-file)
      var epic-merged = (jq '[.stories[] | select(.phase == '$phase' and .epic == '$epic' and .merged == true)] | length' $prd-file)
      echo "  Epic "$phase"."$epic" ["$epic-merged"/"$epic-total"]"

      # Get stories in this epic
      var stories = [(jq -r '.stories[] | select(.phase == '$phase' and .epic == '$epic') | "\(.id)|\(.title)|\(.passes // false)|\(.merged // false)|\(.skipped // false)"' $prd-file)]

      for story $stories {
        var parts = [(str:split "|" $story)]
        var sid = $parts[0]
        var title = $parts[1]
        var passes = $parts[2]
        var merged = $parts[3]
        var skipped = $parts[4]

        var status-icon = "[ ]"
        if (eq $skipped "true") {
          set status-icon = "[~]"  # skipped
        } elif (eq $merged "true") {
          set status-icon = "[x]"  # merged
        } elif (eq $passes "true") {
          set status-icon = "[*]"  # passed, awaiting merge
        }
        echo "    "$status-icon" "$sid": "$title
      }
    }
    echo ""
  }

  echo "───────────────────────────────────────────────────────"
  echo "Legend: [x] merged  [*] passed  [~] skipped  [ ] pending"
  echo "═══════════════════════════════════════════════════════"
}

# Get dependency info for a story (formatted for display)
# Supports new syntax: v1.0, v1.0:1, v1.0:1:2, v1.0:STORY-X, 1, 1:2, STORY-X
fn get-story-deps {|story-id|
  var deps-query = ".stories[] | select(.id == \""$story-id"\") | .depends_on // [] | .[]"
  var deps = [(jq -r $deps-query $prd-file)]

  if (eq (count $deps) 0) {
    echo "None (this story has no dependencies)"
  } else {
    for dep $deps {
      var is-met = (check-dep-met $dep)
      var status = "PENDING"
      if $is-met {
        set status = "MET"
      }

      # Format based on dependency type
      if (re:match '^v[0-9]+\.[0-9]+$' $dep) {
        # Entire version
        echo "- "$dep" (entire version) ["$status"]"
      } elif (re:match '^v[0-9]+\.[0-9]+:' $dep) {
        # Cross-version with target
        echo "- "$dep" (cross-version) ["$status"]"
      } elif (re:match '^STORY-' $dep) {
        # Specific story - get title
        var title = (jq -r '.stories[] | select(.id == "'$dep'") | .title // "Unknown"' $prd-file)
        echo "- "$dep": "$title" ["$status"]"
      } elif (re:match '^[0-9]+:[0-9]+$' $dep) {
        # Phase:Epic
        echo "- Phase:Epic "$dep" ["$status"]"
      } elif (re:match '^[0-9]+$' $dep) {
        # Just phase
        echo "- Phase "$dep" ["$status"]"
      } else {
        echo "- "$dep" ["$status"]"
      }
    }
  }
}

# ═══════════════════════════════════════════════════════════════════════════
# VERSION SUPPORT
# ═══════════════════════════════════════════════════════════════════════════

# Get all unique versions in the PRD
fn get-versions {
  jq -r '.stories | map(.target_version // "v1.0") | unique | .[]' $prd-file
}

# Get next available story for a specific version
# (used when --target-version is specified)
fn get-next-story-for-version {|version|
  var file = (get-version-file $version)
  if (not (path:is-regular $file)) {
    put ""
    return
  }

  # Temporarily set prd-file to the target version's file
  var saved-file = $prd-file
  var saved-version = $current-version
  set prd-file = $file
  set current-version = $version

  # Use the standard get-next-story with cross-version dep support
  var result = (get-next-story)

  # Restore
  set prd-file = $saved-file
  set current-version = $saved-version

  put $result
}

# Check if all stories for a version are merged
fn version-complete {|version|
  var not-merged = (jq '[.stories[] | select((.target_version // "v1.0") == "'$version'" and .merged != true)] | length' $prd-file)
  eq $not-merged "0"
}

# Get version progress (returns "merged/total")
fn get-version-progress {|version|
  var total = (jq '[.stories[] | select((.target_version // "v1.0") == "'$version'")] | length' $prd-file)
  var merged = (jq '[.stories[] | select((.target_version // "v1.0") == "'$version'" and .merged == true)] | length' $prd-file)
  put $merged"/"$total
}

# Show version status summary (reads from all prd/*.json files)
fn show-version-status {
  echo "═══════════════════════════════════════════════════════"
  echo "  VERSION STATUS"
  echo "═══════════════════════════════════════════════════════"
  echo ""

  var versions = [(list-versions)]

  for ver $versions {
    var file = (get-version-file $ver)
    var total = (jq '.stories | length' $file)
    var merged = (jq '[.stories[] | select(.merged == true)] | length' $file)
    var passed = (jq '[.stories[] | select(.passes == true)] | length' $file)
    var skipped = (jq '[.stories[] | select(.skipped == true)] | length' $file)

    var pct = 0
    if (> $total 0) {
      set pct = (/ (* $merged 100) $total)
    }

    var status = "in_progress"
    if (eq $merged $total) {
      set status = "complete"
    }

    echo $ver" ["$status"]"
    echo "  File: prd/"$ver".json"
    echo "  Progress: "$merged"/"$total" ("$pct"%)"
    echo "  - Passed (awaiting merge): "(- $passed $merged)
    echo "  - Skipped: "$skipped
    echo "  - Remaining: "(- $total $passed)
    echo ""
  }

  echo "═══════════════════════════════════════════════════════"
}

# Get story's target version
fn get-story-version {|story-id|
  jq -r '.stories[] | select(.id == "'$story-id'") | .target_version // "v1.0"' $prd-file
}

# ═══════════════════════════════════════════════════════════════════════════
# RELEASE SUPPORT
# ═══════════════════════════════════════════════════════════════════════════

# Get count of completed (merged) stories in current PRD
fn get-story-count {
  jq '[.stories[] | select(.merged == true)] | length' $prd-file
}

# Get stories summary for release PR body
fn get-stories-summary {
  var summary = ""

  # Get unique phases
  var phases = [(jq -r '.stories | map(.phase) | unique | .[]' $prd-file)]

  for phase $phases {
    # Get phase name from first story in phase (or use "Phase N")
    var phase-name = "Phase "$phase

    # Count merged stories in this phase
    var phase-merged = (jq '[.stories[] | select(.phase == '$phase' and .merged == true)] | length' $prd-file)
    if (== $phase-merged 0) {
      continue
    }

    set summary = $summary"### "$phase-name"\n"

    # Get unique epics in this phase
    var epics = [(jq -r '.stories | map(select(.phase == '$phase') | .epic) | unique | .[]' $prd-file)]

    for epic $epics {
      var epic-merged = (jq '[.stories[] | select(.phase == '$phase' and .epic == '$epic' and .merged == true)] | length' $prd-file)
      if (== $epic-merged 0) {
        continue
      }

      set summary = $summary"**Epic "$phase"."$epic"**\n"

      # Get merged stories in this epic
      var stories = [(jq -r '.stories[] | select(.phase == '$phase' and .epic == '$epic' and .merged == true) | "- \(.id): \(.title)"' $prd-file)]

      for story $stories {
        set summary = $summary$story"\n"
      }
      set summary = $summary"\n"
    }
  }

  put $summary
}

# Mark version as released in PRD
fn mark-version-released {|version tag commit|
  var tmp = (mktemp)
  var timestamp = (date -u +"%Y-%m-%dT%H:%M:%SZ")
  jq '. + {
    released: true,
    released_at: "'$timestamp'",
    release_tag: "'$tag'",
    release_commit: "'$commit'"
  }' $prd-file > $tmp
  mv $tmp $prd-file
}

# Check if version is released
fn is-version-released {|version|
  var file = (get-version-file $version)
  if (not (path:is-regular $file)) {
    put $false
    return
  }
  var released = (jq -r '.released // false' $file)
  eq $released "true"
}

# Show blocked state with details about what's waiting on what
fn show-blocked-state {
  echo ""
  ui:box "BLOCKED - WAITING ON DEPENDENCIES" "warn"
  echo ""

  # Show unmerged PRs
  var unmerged = [(get-unmerged-passed)]
  if (> (count $unmerged) 0) {
    echo "Unmerged PRs:"
    for sid $unmerged {
      var pr-url = (get-pr-url $sid)
      var title = (get-story-title $sid)
      if (not (eq $pr-url "")) {
        ui:dim "  • "$sid" ("$title"): "$pr-url
      } else {
        var branch = (get-story-branch $sid)
        ui:dim "  • "$sid" ("$title") - no PR yet (branch: "$branch")"
      }
    }
    echo ""
  }

  # Show blocked stories
  var blocked = [(get-blocked-stories)]
  if (> (count $blocked) 0) {
    echo "Pending stories blocked by unmerged work:"
    for info $blocked {
      var title = (get-story-title $info[story])
      ui:dim "  • "$info[story]" ("$title") → waiting on "$info[blocked_by]
    }
    echo ""
  }

  ui:dim "Run ralph to pick up where you left off."
}

# Handle skip mode: skip story and log to activity
fn handle-skip {|story-id reason project-root|
  ui:status "Skipping story: "$story-id
  ui:dim "  Reason: "$reason
  skip-story $story-id $reason

  # Log to activity
  var today = (date '+%Y-%m-%d')
  var timestamp = (date '+%Y-%m-%d %H:%M')
  var activity-file = (path:join $project-root "logs" "activity" "trinity" $today".md")
  var story-title = (get-story-title $story-id)
  var story-info = (get-story-info $story-id)
  var info-parts = [(str:split "\t" $story-info)]
  var phase = $info-parts[0]
  var epic = $info-parts[1]

  echo "" >> $activity-file
  echo "## "$story-id": "$story-title >> $activity-file
  echo "" >> $activity-file
  echo "**Phase:** "$phase" | **Epic:** "$epic" | **Version:** "$current-version >> $activity-file
  echo "**Skipped:** "$timestamp >> $activity-file
  echo "" >> $activity-file
  echo "### Reason" >> $activity-file
  echo $reason >> $activity-file
  echo "" >> $activity-file
  echo "---" >> $activity-file

  ui:success "Story skipped. Dependents can now proceed."
}

# Check if a story has external dependencies
fn has-external-deps {|story-id|
  var deps = (jq -r '.stories[] | select(.id == "'$story-id'") | .external_deps // [] | length' $prd-file)
  not (eq $deps "0")
}

# Get external dependencies for a story (returns list of {name, description} maps)
fn get-external-deps {|story-id|
  jq -r '.stories[] | select(.id == "'$story-id'") | .external_deps // [] | .[] | "\(.name)|\(.description)"' $prd-file
}

# Get user report for external dependencies via editor
# Opens editor with dep descriptions, returns user's implementation report
fn get-external-deps-report {|story-id|
  echo "" > /dev/tty

  # Create temp file with dep context
  var tmp = (mktemp --suffix=.md)
  var story-title = (get-story-title $story-id)

  echo "# External Dependencies Report for "$story-id > $tmp
  echo "# "$story-title >> $tmp
  echo "#" >> $tmp
  echo "# This story requires the following external dependencies to be set up:" >> $tmp
  echo "#" >> $tmp

  # Add each dependency as a comment
  var deps = [(get-external-deps $story-id)]
  for dep $deps {
    var parts = [(str:split "|" $dep)]
    var name = $parts[0]
    var desc = ""
    if (> (count $parts) 1) {
      set desc = $parts[1]
    }
    echo "# - "$name": "$desc >> $tmp
  }

  echo "#" >> $tmp
  echo "# Describe how you implemented these dependencies below." >> $tmp
  echo "# Include: endpoints, auth methods, API keys location, schemas, etc." >> $tmp
  echo "# Lines starting with # are ignored." >> $tmp
  echo "# Save and close to submit, empty file to cancel." >> $tmp
  echo "" >> $tmp

  # Determine editor (fallback chain)
  var editor = "vim"
  if (has-env EDITOR) {
    set editor = $E:EDITOR
  } elif (has-env VISUAL) {
    set editor = $E:VISUAL
  }

  ui:status "Opening editor for external deps report..." > /dev/tty
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
    ui:dim "No report provided (empty or cancelled)" > /dev/tty
  }

  put $content
}

# Get user clarification for a story via editor
# Opens editor with validation questions, returns user's clarification text
fn get-clarification {|story-id questions|
  echo "" > /dev/tty

  # Create temp file with story context and questions
  var tmp = (mktemp --suffix=.md)
  var story-title = (get-story-title $story-id)

  echo "# Clarify Story "$story-id > $tmp
  echo "# "$story-title >> $tmp
  echo "#" >> $tmp
  echo "# Claude identified these questions:" >> $tmp
  echo "#" >> $tmp
  # Add questions as comments
  for line [(str:split "\n" $questions)] {
    if (not (eq (str:trim-space $line) "")) {
      echo "# "$line >> $tmp
    }
  }
  echo "#" >> $tmp
  echo "# Add your clarifications below." >> $tmp
  echo "# Lines starting with # are ignored." >> $tmp
  echo "# Save and close to submit, empty file to cancel." >> $tmp
  echo "" >> $tmp

  # Determine editor (fallback chain)
  var editor = "vim"
  if (has-env EDITOR) {
    set editor = $E:EDITOR
  } elif (has-env VISUAL) {
    set editor = $E:VISUAL
  }

  ui:status "Opening editor for clarification..." > /dev/tty
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
    ui:dim "No clarification provided (empty or cancelled)" > /dev/tty
  }

  put $content
}
