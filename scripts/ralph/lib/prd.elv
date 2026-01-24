# PRD and story operations for Ralph

use str

# PRD file path (set by init)
var prd-file = ""

# Initialize with PRD file path
fn init {|path|
  set prd-file = $path
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

# Get next available story (respects dependencies)
fn get-next-story {
  # Get all completed story IDs
  var completed = [(jq -r '.stories[] | select(.passes == true) | .id' $prd-file)]

  # Get stories that are not complete
  var candidates = [(jq -r '.stories[] | select(.passes != true) | "\(.id)|\(.depends_on // [] | join(","))"' $prd-file)]

  for candidate $candidates {
    var parts = [(str:split "|" $candidate)]
    var sid = $parts[0]
    var deps-str = $parts[1]

    # Check if all dependencies are completed
    var deps-met = $true
    if (not (eq $deps-str "")) {
      var deps = [(str:split "," $deps-str)]
      for dep $deps {
        var found = $false
        for c $completed {
          if (eq $c $dep) {
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

# Check if all stories are complete
fn all-stories-complete {
  var incomplete = (jq '[.stories[] | select(.passes != true)] | length' $prd-file)
  eq $incomplete "0"
}

# Get dependency info for a story (formatted for display)
fn get-story-deps {|story-id|
  var deps-query = ".stories[] | select(.id == \""$story-id"\") | .depends_on // [] | .[]"
  var deps = [(jq -r $deps-query $prd-file)]

  if (eq (count $deps) 0) {
    echo "None (this story has no dependencies)"
  } else {
    for did $deps {
      var info-query = ".stories[] | select(.id == \""$did"\") | \"\\(.title)|\\(.passes // false)\""
      var dep-info = (jq -r $info-query $prd-file)
      var parts = [(str:split "|" $dep-info)]
      var title = $parts[0]
      var passes = $parts[1]
      var status = "PENDING"
      if (eq $passes "true") {
        set status = "DONE"
      }
      echo "- "$did": "$title" ["$status"]"
    }
  }
}
