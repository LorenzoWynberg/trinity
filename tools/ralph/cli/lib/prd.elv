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

# Get phase name from PRD metadata
fn get-phase-name {|phase-id|
  var name = (jq -r '.phases[]? | select(.id == '$phase-id') | .name // ""' $prd-file)
  if (eq $name "") {
    put "Phase "$phase-id
  } else {
    put $name
  }
}

# Get epic name from PRD metadata
fn get-epic-name {|phase-id epic-id|
  var name = (jq -r '.epics[]? | select(.phase == '$phase-id' and .id == '$epic-id') | .name // ""' $prd-file)
  if (eq $name "") {
    put "Epic "$phase-id"."$epic-id
  } else {
    put $name
  }
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

# Check if a story exists in the PRD
fn story-exists {|story-id|
  # Handle both STORY-X.Y.Z and X.Y.Z formats
  var normalized = $story-id
  if (not (str:has-prefix $story-id "STORY-")) {
    set normalized = "STORY-"$story-id
  }
  var found = (jq -r '.stories[] | select(.id == "'$normalized'") | .id // ""' $prd-file)
  not (eq $found "")
}

# Normalize story ID to STORY-X.Y.Z format
fn normalize-story-id {|story-id|
  if (str:has-prefix $story-id "STORY-") {
    put $story-id
  } else {
    put "STORY-"$story-id
  }
}

# Check if a story's dependencies are met
# Returns [&met=$bool &unmet=[$list of dep info maps]]
fn check-story-deps {|story-id|
  var normalized = (normalize-story-id $story-id)
  var deps = [(jq -r '.stories[] | select(.id == "'$normalized'") | .depends_on // [] | .[]' $prd-file)]

  var unmet = []

  for dep $deps {
    if (not (check-dep-met $dep)) {
      # Get detailed info about this unmet dependency
      var dep-info = [&dep=$dep &status="unknown" &detail=""]

      if (re:match '^STORY-' $dep) {
        # It's a specific story - get its status
        var story-passes = (jq -r '.stories[] | select(.id == "'$dep'") | .passes // false' $prd-file)
        var story-merged = (jq -r '.stories[] | select(.id == "'$dep'") | .merged // false' $prd-file)
        var story-pr = (jq -r '.stories[] | select(.id == "'$dep'") | .pr_url // ""' $prd-file)
        var story-title = (jq -r '.stories[] | select(.id == "'$dep'") | .title // ""' $prd-file)
        var story-branch = (get-story-branch $dep)

        set dep-info[title] = $story-title

        if (eq $story-merged "true") {
          # Shouldn't happen since we're in unmet, but handle it
          set dep-info[status] = "merged"
        } elif (eq $story-passes "true") {
          if (not (eq $story-pr "")) {
            set dep-info[status] = "pr_open"
            set dep-info[detail] = $story-pr
          } else {
            set dep-info[status] = "passed_no_pr"
            set dep-info[detail] = $story-branch
          }
        } else {
          # Check if it's in progress (has a branch)
          var branch-exists = $false
          try {
            git rev-parse --verify $story-branch >/dev/null 2>&1
            set branch-exists = $true
          } catch _ { }

          if $branch-exists {
            set dep-info[status] = "in_progress"
            set dep-info[detail] = $story-branch
          } else {
            set dep-info[status] = "pending"
          }
        }
      } else {
        # It's a phase/epic/version dependency
        set dep-info[status] = "incomplete"
        set dep-info[detail] = "Not all stories merged"
      }

      set unmet = [$@unmet $dep-info]
    }
  }

  put [&met=(eq (count $unmet) 0) &unmet=$unmet]
}

# Show friendly dependency status for a story
fn show-story-dep-status {|story-id|
  var normalized = (normalize-story-id $story-id)
  var title = (get-story-title $normalized)
  var result = (check-story-deps $normalized)

  if $result[met] {
    ui:success "All dependencies met for "$normalized
    put $true
    return
  }

  echo ""
  ui:warn "Can't start "$normalized" - dependencies not met:"
  echo ""

  for info $result[unmet] {
    var dep = $info[dep]
    var status = $info[status]
    var detail = $info[detail]

    if (re:match '^STORY-' $dep) {
      var dep-title = ""
      if (has-key $info title) {
        set dep-title = $info[title]
      }
      echo "  "$dep" ("$dep-title")"

      if (eq $status "pr_open") {
        ui:dim "  └── PR open, waiting for merge"
        ui:dim "  └── "$detail
      } elif (eq $status "passed_no_pr") {
        ui:dim "  └── Passed but no PR created yet"
        ui:dim "  └── Branch: "$detail
      } elif (eq $status "in_progress") {
        ui:dim "  └── In progress"
        ui:dim "  └── Branch: "$detail
      } else {
        ui:dim "  └── Not started yet"
      }
    } else {
      echo "  "$dep
      ui:dim "  └── "$detail
    }
    echo ""
  }

  put $false
}

# Get count of stories that would be unblocked if given deps were met
fn count-unblocked-if-merged {|story-ids|
  var count = 0
  var all-stories = [(jq -r '.stories[] | select(.passes != true) | .id' $prd-file)]

  for sid $all-stories {
    var deps = [(jq -r '.stories[] | select(.id == "'$sid'") | .depends_on // [] | .[]' $prd-file)]
    var would-unblock = $true

    for dep $deps {
      # Check if dep is in our story-ids list or already met
      var dep-in-list = $false
      for check-id $story-ids {
        if (eq $dep $check-id) {
          set dep-in-list = $true
          break
        }
      }

      if (and (not $dep-in-list) (not (check-dep-met $dep))) {
        set would-unblock = $false
        break
      }
    }

    if $would-unblock {
      set count = (+ $count 1)
    }
  }

  put $count
}

# Show friendly "nothing to do" status
fn show-nothing-runnable {
  # Check if all complete
  if (all-stories-complete) {
    echo ""
    ui:box "All stories complete! Nothing left to work on." "success"
    echo ""
    ui:dim "Run ./ralph.elv --status to see the full picture."
    return
  }

  # There are stories but they're all blocked
  echo ""
  ui:box "Nothing runnable right now" "info"
  echo ""

  # Show what's blocking
  var unmerged = [(get-unmerged-passed)]
  var blocking-ids = []

  if (> (count $unmerged) 0) {
    echo "Waiting on:"
    for sid $unmerged {
      var pr-url = (get-pr-url $sid)
      var title = (get-story-title $sid)
      set blocking-ids = [$@blocking-ids $sid]

      if (not (eq $pr-url "")) {
        ui:dim "  • "$sid" - PR needs merge"
        ui:dim "    "$pr-url
      } else {
        ui:dim "  • "$sid" - Passed, needs PR"
      }
    }
    echo ""
  }

  # Show blocked count
  var blocked = [(get-blocked-stories)]
  var blocked-count = (count $blocked)

  if (> $blocked-count 0) {
    var would-unblock = (count-unblocked-if-merged $unmerged)
    if (> $would-unblock 0) {
      ui:dim "Once these complete, "$would-unblock" more stories will be unblocked."
    }
  }
}

# Get next available story (respects dependencies - deps must be MERGED)
# Uses smart selection: scores candidates by proximity, tag overlap, blocker value
# Optional last-completed parameter for context retention scoring
fn get-next-story {|&last-completed=""|
  # Get stories that haven't passed yet (available for work)
  var candidates = [(jq -r '.stories[] | select(.passes != true) | "\(.id)|\(.depends_on // [] | join(","))"' $prd-file)]

  # Filter to only runnable candidates (deps met)
  var runnable = []
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
      set runnable = [$@runnable $sid]
    }
  }

  # No runnable stories
  if (== (count $runnable) 0) {
    put ""
    return
  }

  # If only one candidate, return it
  if (== (count $runnable) 1) {
    put $runnable[0]
    return
  }

  # Score all runnable candidates
  var best-id = ""
  var best-score = -1.0

  for sid $runnable {
    var result = (score-story $sid $last-completed)
    if (> $result[score] $best-score) {
      set best-score = $result[score]
      set best-id = $sid
    }
  }

  put $best-id
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
    # Phase header with name
    var phase-name = (get-phase-name $phase)
    var phase-total = (jq '[.stories[] | select(.phase == '$phase')] | length' $prd-file)
    var phase-merged = (jq '[.stories[] | select(.phase == '$phase' and .merged == true)] | length' $prd-file)
    echo $phase-name" ["$phase-merged"/"$phase-total"]"

    # Get unique epics in this phase
    var epics = [(jq -r '.stories | map(select(.phase == '$phase') | .epic) | unique | .[]' $prd-file)]

    for epic $epics {
      var epic-name = (get-epic-name $phase $epic)
      var epic-total = (jq '[.stories[] | select(.phase == '$phase' and .epic == '$epic')] | length' $prd-file)
      var epic-merged = (jq '[.stories[] | select(.phase == '$phase' and .epic == '$epic' and .merged == true)] | length' $prd-file)
      echo "  "$epic-name" ["$epic-merged"/"$epic-total"]"

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
fn get-next-story-for-version {|version &last-completed=""|
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
  var result = (get-next-story &last-completed=$last-completed)

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
  ui:box "Taking a break - waiting for PR reviews" "info"
  echo ""

  # Show unmerged PRs
  var unmerged = [(get-unmerged-passed)]
  if (> (count $unmerged) 0) {
    echo "Ralph has done everything it can! These PRs need attention:"
    echo ""
    for sid $unmerged {
      var pr-url = (get-pr-url $sid)
      var title = (get-story-title $sid)
      if (not (eq $pr-url "")) {
        echo "  "$sid" ("$title")"
        ui:dim "  └── PR open, needs merge: "$pr-url
      } else {
        var branch = (get-story-branch $sid)
        echo "  "$sid" ("$title")"
        ui:dim "  └── Passed but no PR yet (branch: "$branch")"
      }
    }
    echo ""
  }

  # Show blocked stories
  var blocked = [(get-blocked-stories)]
  if (> (count $blocked) 0) {
    var would-unblock = (count-unblocked-if-merged $unmerged)
    if (> $would-unblock 0) {
      ui:dim "Once merged, "$would-unblock" more stories will be unblocked."
    }
    echo ""
  }

  ui:dim "Merge the open PRs and Ralph will automatically continue."
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

# ═══════════════════════════════════════════════════════════════════════════
# EXTERNAL DEPS PROPAGATION
# ═══════════════════════════════════════════════════════════════════════════

# Save external deps report to a story in the PRD
fn save-external-deps-report {|story-id report|
  var tmp = (mktemp)
  # Escape the report for JSON (handle newlines, quotes)
  var escaped-report = (echo $report | jq -Rs '.')
  jq '(.stories[] | select(.id == "'$story-id'")).external_deps_report = '$escaped-report $prd-file > $tmp
  mv $tmp $prd-file
}

# Get all descendants of a story (stories that depend on it, recursively)
# Returns list of story IDs
fn get-descendants {|story-id|
  var descendants = []
  var to-check = [$story-id]
  var checked = [&]

  while (> (count $to-check) 0) {
    var current = $to-check[0]
    set to-check = $to-check[1..]

    if (has-key $checked $current) {
      continue
    }
    set checked[$current] = $true

    # Find stories that depend on current (directly)
    var dependents = [(jq -r '.stories[] | select(.depends_on != null) | select(.depends_on[] == "'$current'") | .id' $prd-file)]

    for dep $dependents {
      if (not (has-key $checked $dep)) {
        set descendants = [$@descendants $dep]
        set to-check = [$@to-check $dep]
      }
    }
  }

  put $@descendants
}

# Get summary of stories for Claude to analyze
# Returns formatted string with id, title, acceptance for each story
fn get-stories-summary {|story-ids|
  var summary = ""
  for sid $story-ids {
    var title = (jq -r '.stories[] | select(.id == "'$sid'") | .title // ""' $prd-file)
    var acceptance = (jq -r '.stories[] | select(.id == "'$sid'") | .acceptance // [] | join("; ")' $prd-file)
    var tags = (jq -r '.stories[] | select(.id == "'$sid'") | .tags // [] | join(", ")' $prd-file)
    set summary = $summary"- "$sid": "$title"\n  Tags: ["$tags"]\n  Acceptance: "$acceptance"\n\n"
  }
  put $summary
}

# Update a story's acceptance criteria
fn update-story-acceptance {|story-id new-acceptance-json|
  var tmp = (mktemp)
  jq '(.stories[] | select(.id == "'$story-id'")).acceptance = '$new-acceptance-json $prd-file > $tmp
  mv $tmp $prd-file
}

# Update a story's tags
fn update-story-tags {|story-id tags-json|
  var tmp = (mktemp)
  jq '(.stories[] | select(.id == "'$story-id'")).tags = '$tags-json $prd-file > $tmp
  mv $tmp $prd-file
}

# Update multiple fields on a story
# fields-json is a JSON object like {"acceptance": [...], "tags": [...]}
fn update-story {|story-id fields-json|
  var tmp = (mktemp)
  jq '(.stories[] | select(.id == "'$story-id'")) |= . + '$fields-json $prd-file > $tmp
  mv $tmp $prd-file
}

# Find stories with overlapping tags (for duplicate detection)
# Returns story IDs that share at least N tags with the given tags
fn find-similar-by-tags {|tags-json &min-overlap=(num 2)|
  var result = []
  try {
    set result = [(jq -r --argjson tags $tags-json --argjson min $min-overlap '
      .stories[] |
      select((.tags // []) as $story_tags |
        ([$story_tags[] | select(. as $t | $tags | index($t))] | length) >= $min
      ) |
      .id
    ' $prd-file)]
  } catch _ { }
  put $@result
}

# Create a new story in the PRD
# story-json should be a complete story object as JSON string
fn create-story {|story-json|
  var tmp = (mktemp)
  jq '.stories += ['$story-json']' $prd-file > $tmp
  mv $tmp $prd-file
  sort-stories
}

# Sort stories by phase, epic, story_number
fn sort-stories {
  var tmp = (mktemp)
  jq '.stories = (.stories | sort_by(.phase, .epic, .story_number))' $prd-file > $tmp
  mv $tmp $prd-file
}

# Get the next available story number for a phase.epic
fn get-next-story-number {|phase epic|
  var max = (jq '[.stories[] | select(.phase == '$phase' and .epic == '$epic') | .story_number] | max // 0' $prd-file)
  put (+ $max 1)
}

# Validate dependencies exist and no cycles
# Returns [&valid=$bool &errors=[$list]]
fn validate-dependencies {|story-id depends-on|
  var errors = []

  for dep $depends-on {
    # Check dep exists (handle both X.Y.Z and STORY-X.Y.Z formats)
    var dep-id = $dep
    if (str:has-prefix $dep "STORY-") {
      set dep-id = (str:trim-prefix $dep "STORY-")
    }

    var exists = (jq -r '.stories[] | select(.id == "'$dep-id'") | .id // ""' $prd-file)
    if (eq $exists "") {
      set errors = [$@errors "Dependency "$dep" does not exist"]
    }

    # Check for cycle (would dep eventually depend on story-id?)
    var dep-descendants = [(get-descendants $dep-id)]
    for desc $dep-descendants {
      if (eq $desc $story-id) {
        set errors = [$@errors "Circular dependency: "$dep" eventually depends on "$story-id]
      }
    }
  }

  put [&valid=(eq (count $errors) 0) &errors=$errors]
}

# Add a dependency to a story
fn add-dependency {|story-id new-dep|
  var tmp = (mktemp)
  jq '(.stories[] | select(.id == "'$story-id'")).depends_on += ["'$new-dep'"]' $prd-file > $tmp
  mv $tmp $prd-file
}

# Check if adding a dependency would create a cycle
# Returns true if cycle would be created
fn would-create-cycle {|story-id potential-dep|
  # If story-id is in potential-dep's descendant tree, adding the dep would create a cycle
  var descendants = [(get-descendants $potential-dep)]
  has-value $descendants $story-id
}

# Get stories that already depend on a given story
fn get-dependents {|story-id|
  var result = []
  try {
    set result = [(jq -r '.stories[] | select(.depends_on != null) | select(.depends_on[] == "'$story-id'") | .id' $prd-file)]
  } catch _ { }
  put $@result
}

# Get story's current dependencies
fn get-story-deps {|story-id|
  var result = []
  try {
    set result = [(jq -r '.stories[] | select(.id == "'$story-id'") | .depends_on[]?' $prd-file)]
  } catch _ { }
  put $@result
}

# ═══════════════════════════════════════════════════════════════════════════
# SMART STORY SELECTION
# ═══════════════════════════════════════════════════════════════════════════
#
# Scoring model (higher = better):
#   tree_proximity * 5.0   - Same epic (1.0), same phase (0.5), other (0.0)
#   tag_overlap * 3.0      - Jaccard similarity with last-completed story
#   blocker_value * 2.0    - How many stories would this unblock
#   priority * 1.0         - User-defined priority (default 0)
#   inverse_complexity * 0.5 - Simpler stories break ties
# ═══════════════════════════════════════════════════════════════════════════

# Calculate tree proximity score between two stories
# Returns: 1.0 (same epic), 0.5 (same phase), 0.0 (different phase)
fn calc-tree-proximity {|story-a story-b|
  if (or (eq $story-a "") (eq $story-b "")) {
    put 0.0
    return
  }

  var a-phase = (num (get-story-phase $story-a))
  var a-epic = (num (get-story-epic $story-a))
  var b-phase = (num (get-story-phase $story-b))
  var b-epic = (num (get-story-epic $story-b))

  if (and (== $a-phase $b-phase) (== $a-epic $b-epic)) {
    put 1.0
  } elif (== $a-phase $b-phase) {
    put 0.5
  } else {
    put 0.0
  }
}

# Calculate Jaccard similarity between two tag sets
# Returns: 0.0 to 1.0 (intersection / union)
fn calc-tag-overlap {|tags-a-json tags-b-json|
  # Handle empty/null cases
  if (or (eq $tags-a-json "[]") (eq $tags-a-json "null") (eq $tags-a-json "")) {
    put 0.0
    return
  }
  if (or (eq $tags-b-json "[]") (eq $tags-b-json "null") (eq $tags-b-json "")) {
    put 0.0
    return
  }

  # Use jq to calculate Jaccard similarity
  var result = (echo $tags-a-json | jq --argjson b $tags-b-json '
    . as $a |
    ($a + $b | unique) as $union |
    if ($union | length) == 0 then 0
    else
      ([$a[] | select(. as $t | $b | index($t))] | length) / ($union | length)
    end
  ')
  put (num $result)
}

# Count how many stories would be unblocked if this story is merged
# Higher = more valuable to complete
fn calc-blocker-value {|story-id|
  var count = 0
  var all-stories = [(jq -r '.stories[] | select(.passes != true) | .id' $prd-file)]

  for sid $all-stories {
    if (eq $sid $story-id) {
      continue
    }
    var deps = [(jq -r '.stories[] | select(.id == "'$sid'") | .depends_on // [] | .[]' $prd-file)]
    for dep $deps {
      if (eq $dep $story-id) {
        set count = (+ $count 1)
        break
      }
    }
  }
  put $count
}

# Get story priority (default 0, higher = more important)
fn get-story-priority {|story-id|
  var priority = (jq -r '.stories[] | select(.id == "'$story-id'") | .priority // 0' $prd-file)
  put (num $priority)
}

# Estimate story complexity based on acceptance criteria count
# Returns inverse: simpler = higher score (for tie-breaking)
fn calc-inverse-complexity {|story-id|
  var ac-count = (num (jq '[.stories[] | select(.id == "'$story-id'") | .acceptance // [] | length] | .[0] // 0' $prd-file))
  # Normalize: 1 AC = 1.0, 10 AC = 0.1
  if (== $ac-count 0) {
    put 1.0
  } else {
    put (/ 1.0 $ac-count)
  }
}

# Calculate composite score for a story
# last-completed: story ID of last merged story (for context retention)
fn score-story {|story-id last-completed|
  # Tree proximity: same epic/phase as last completed
  var proximity = (calc-tree-proximity $story-id $last-completed)

  # Tag overlap with last completed
  var tags-a = (get-story-tags $story-id)
  var tags-b = ""
  if (not (eq $last-completed "")) {
    set tags-b = (get-story-tags $last-completed)
  } else {
    set tags-b = "[]"
  }
  var tag-overlap = (calc-tag-overlap $tags-a $tags-b)

  # Blocker value: how many stories depend on this one
  var blocker-value = (calc-blocker-value $story-id)
  # Normalize to 0-1 range (assume max 10 dependents)
  var blocker-score = (/ (num $blocker-value) 10.0)
  if (> $blocker-score 1.0) {
    set blocker-score = 1.0
  }

  # User priority
  var priority = (get-story-priority $story-id)
  # Normalize to 0-1 range (assume max priority 10)
  var priority-score = (/ $priority 10.0)
  if (> $priority-score 1.0) {
    set priority-score = 1.0
  }

  # Inverse complexity (simpler = higher)
  var inv-complexity = (calc-inverse-complexity $story-id)

  # Weighted sum
  var score = (+
    (* $proximity 5.0)
    (* $tag-overlap 3.0)
    (* $blocker-score 2.0)
    (* $priority-score 1.0)
    (* $inv-complexity 0.5)
  )

  put [
    &story_id=$story-id
    &score=$score
    &proximity=$proximity
    &tag_overlap=$tag-overlap
    &blocker_value=$blocker-value
    &priority=$priority
  ]
}

# Get overall progress stats
# Returns map with total, merged, passed, percentage
fn get-progress-stats {
  var total = (num (jq '.stories | length' $prd-file))
  var merged = (num (jq '[.stories[] | select(.merged == true)] | length' $prd-file))
  var passed = (num (jq '[.stories[] | select(.passes == true)] | length' $prd-file))
  var pct = 0
  if (> $total 0) {
    set pct = (/ (* $merged 100) $total)
  }
  put [&total=$total &merged=$merged &passed=$passed &pct=$pct]
}

# Get progress per phase
# Returns list of maps with phase, name, total, merged
fn get-phase-progress {
  var result = []
  var phases = [(jq -r '.stories | map(.phase) | unique | .[]' $prd-file)]

  for phase $phases {
    var name = (get-phase-name $phase)
    var total = (num (jq '[.stories[] | select(.phase == '$phase')] | length' $prd-file))
    var merged = (num (jq '[.stories[] | select(.phase == '$phase' and .merged == true)] | length' $prd-file))
    set result = [$@result [&phase=$phase &name=$name &total=$total &merged=$merged]]
  }

  put $result
}

# Get story phase number
fn get-story-phase {|story-id|
  jq -r '.stories[] | select(.id == "'$story-id'") | .phase' $prd-file
}

# Get story epic number
fn get-story-epic {|story-id|
  jq -r '.stories[] | select(.id == "'$story-id'") | .epic' $prd-file
}

# Get story tags as JSON array
fn get-story-tags {|story-id|
  jq -c '.stories[] | select(.id == "'$story-id'") | .tags // []' $prd-file
}

# Sort stories by tree proximity to a source story
# Returns stories ordered: same epic → same phase → adjacent phase → distant
fn sort-by-proximity {|source-id story-ids|
  var source-phase = (num (get-story-phase $source-id))
  var source-epic = (num (get-story-epic $source-id))

  var same-epic = []
  var same-phase = []
  var adjacent-phase = []
  var distant = []

  for sid $story-ids {
    var sid-phase = (num (get-story-phase $sid))
    var sid-epic = (num (get-story-epic $sid))

    if (and (eq $sid-phase $source-phase) (eq $sid-epic $source-epic)) {
      set same-epic = [$@same-epic $sid]
    } elif (eq $sid-phase $source-phase) {
      set same-phase = [$@same-phase $sid]
    } elif (or (eq $sid-phase (- $source-phase 1)) (eq $sid-phase (+ $source-phase 1))) {
      set adjacent-phase = [$@adjacent-phase $sid]
    } else {
      set distant = [$@distant $sid]
    }
  }

  put [$@same-epic $@same-phase $@adjacent-phase $@distant]
}
