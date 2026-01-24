# PRD and story operations for Ralph

use str

# PRD file path (set by init)
var prd-file = ""

# Initialize with PRD file path
fn init {|path|
  set prd-file = $path
}

# Get PRD file path (for other modules)
fn get-prd-file {
  put $prd-file
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
  var info = (str:trim-space (get-story-info $story-id | slurp))
  if (eq $info "") {
    fail "Story "$story-id" not found in PRD"
  }
  var parts = [(str:split "\t" $info)]
  if (< (count $parts) 3) {
    fail "Invalid story info format for "$story-id
  }
  put "feat/story-"$parts[0]"."$parts[1]"."$parts[2]
}

# Get next available story (respects dependencies - deps must be MERGED)
fn get-next-story {
  # Get all MERGED story IDs (dependencies must be merged, not just passed)
  var merged = [(jq -r '.stories[] | select(.merged == true) | .id' $prd-file)]

  # Get stories that haven't passed yet (available for work)
  var candidates = [(jq -r '.stories[] | select(.passes != true) | "\(.id)|\(.depends_on // [] | join(","))"' $prd-file)]

  for candidate $candidates {
    var parts = [(str:split "|" $candidate)]
    var sid = $parts[0]
    var deps-str = $parts[1]

    # Check if all dependencies are MERGED
    var deps-met = $true
    if (not (eq $deps-str "")) {
      var deps = [(str:split "," $deps-str)]
      for dep $deps {
        var found = $false
        for m $merged {
          if (eq $m $dep) {
            set found = $true
            break
          }
        }
        if (not $found) {
          set deps-met = $false
          break
        }
      }
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

# Get branch name for a story (for resuming merge)
fn get-story-branch {|story-id|
  var info = (str:trim-space (get-story-info $story-id | slurp))
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
fn get-story-deps {|story-id|
  var deps-query = ".stories[] | select(.id == \""$story-id"\") | .depends_on // [] | .[]"
  var deps = [(jq -r $deps-query $prd-file)]

  if (eq (count $deps) 0) {
    echo "None (this story has no dependencies)"
  } else {
    for did $deps {
      var info-query = ".stories[] | select(.id == \""$did"\") | \"\\(.title)|\\(.passes // false)|\\(.merged // false)\""
      var dep-info = (jq -r $info-query $prd-file)
      var parts = [(str:split "|" $dep-info)]
      var title = $parts[0]
      var passes = $parts[1]
      var merged = $parts[2]
      var status = "PENDING"
      if (eq $merged "true") {
        set status = "MERGED"
      } elif (eq $passes "true") {
        set status = "PASSED (not merged)"
      }
      echo "- "$did": "$title" ["$status"]"
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
fn get-next-story-for-version {|version|
  # Get all MERGED story IDs
  var merged = [(jq -r '.stories[] | select(.merged == true) | .id' $prd-file)]

  # Get stories for this version that haven't passed yet
  var candidates = [(jq -r '.stories[] | select(.passes != true and (.target_version // "v1.0") == "'$version'") | "\(.id)|\(.depends_on // [] | join(","))"' $prd-file)]

  for candidate $candidates {
    var parts = [(str:split "|" $candidate)]
    var sid = $parts[0]
    var deps-str = $parts[1]

    # Check if all dependencies are MERGED
    var deps-met = $true
    if (not (eq $deps-str "")) {
      var deps = [(str:split "," $deps-str)]
      for dep $deps {
        var found = $false
        for m $merged {
          if (eq $m $dep) {
            set found = $true
            break
          }
        }
        if (not $found) {
          set deps-met = $false
          break
        }
      }
    }

    if $deps-met {
      put $sid
      return
    }
  }

  # No story found
  put ""
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

# Show version status summary
fn show-version-status {
  echo "═══════════════════════════════════════════════════════"
  echo "  VERSION STATUS"
  echo "═══════════════════════════════════════════════════════"
  echo ""

  var versions = [(get-versions)]

  for version $versions {
    var total = (jq '[.stories[] | select((.target_version // "v1.0") == "'$version'")] | length' $prd-file)
    var merged = (jq '[.stories[] | select((.target_version // "v1.0") == "'$version'" and .merged == true)] | length' $prd-file)
    var passed = (jq '[.stories[] | select((.target_version // "v1.0") == "'$version'" and .passes == true)] | length' $prd-file)
    var skipped = (jq '[.stories[] | select((.target_version // "v1.0") == "'$version'" and .skipped == true)] | length' $prd-file)

    var pct = 0
    if (> $total 0) {
      set pct = (/ (* $merged 100) $total)
    }

    var status = "in_progress"
    if (eq $merged $total) {
      set status = "ready_to_release"
    }

    echo $version" ["$status"]"
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
