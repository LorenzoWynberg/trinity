#!/usr/bin/env bash
# PRD and story operations for Ralph

# PRD file path (set by init)
PRD_FILE=""

# Initialize with PRD file path
prd_init() {
  PRD_FILE="$1"
}

# Get story info (phase, epic, story_number) as tab-separated
prd_get_story_info() {
  local story_id="$1"
  jq -r ".stories[] | select(.id == \"$story_id\") | \"\(.phase)\t\(.epic)\t\(.story_number)\"" "$PRD_FILE"
}

# Get story title
prd_get_story_title() {
  local story_id="$1"
  jq -r ".stories[] | select(.id == \"$story_id\") | .title" "$PRD_FILE"
}

# Build branch name from story ID
prd_get_branch_name() {
  local story_id="$1"
  local info
  info=$(prd_get_story_info "$story_id")

  if [[ -z "$info" ]]; then
    echo "Error: Story $story_id not found in PRD" >&2
    return 1
  fi

  local phase epic story_number
  IFS=$'\t' read -r phase epic story_number <<< "$info"
  echo "feat/story-${phase}.${epic}.${story_number}"
}

# Get next available story (respects dependencies - deps must be MERGED)
prd_get_next_story() {
  # Get all MERGED story IDs
  local merged
  merged=$(jq -r '.stories[] | select(.merged == true) | .id' "$PRD_FILE")

  # Get stories that haven't passed yet
  local candidates
  candidates=$(jq -r '.stories[] | select(.passes != true) | "\(.id)|\(.depends_on // [] | join(","))"' "$PRD_FILE")

  while IFS= read -r candidate; do
    [[ -z "$candidate" ]] && continue

    local sid deps_str
    IFS='|' read -r sid deps_str <<< "$candidate"

    # Check if all dependencies are MERGED
    local deps_met=true
    if [[ -n "$deps_str" ]]; then
      IFS=',' read -ra deps <<< "$deps_str"
      for dep in "${deps[@]}"; do
        if ! echo "$merged" | grep -qx "$dep"; then
          deps_met=false
          break
        fi
      done
    fi

    if [[ "$deps_met" == "true" ]]; then
      echo "$sid"
      return 0
    fi
  done <<< "$candidates"

  # No story found
  echo ""
}

# Check if all stories are merged (truly complete)
prd_all_stories_complete() {
  local not_merged
  not_merged=$(jq '[.stories[] | select(.merged != true)] | length' "$PRD_FILE")
  [[ "$not_merged" == "0" ]]
}

# Mark a story as passed (Claude completed work)
prd_mark_passed() {
  local story_id="$1"
  local tmp
  tmp=$(mktemp)
  jq "(.stories[] | select(.id == \"$story_id\")).passes = true" "$PRD_FILE" > "$tmp"
  mv "$tmp" "$PRD_FILE"
}

# Mark a story as merged (PR merged to base branch)
prd_mark_merged() {
  local story_id="$1"
  local merge_commit="$2"
  local tmp
  tmp=$(mktemp)
  jq "(.stories[] | select(.id == \"$story_id\")) |= . + {merged: true, merge_commit: \"$merge_commit\"}" "$PRD_FILE" > "$tmp"
  mv "$tmp" "$PRD_FILE"
}

# Check if a story is merged
prd_is_merged() {
  local story_id="$1"
  local result
  result=$(jq -r ".stories[] | select(.id == \"$story_id\") | .merged // false" "$PRD_FILE")
  [[ "$result" == "true" ]]
}

# Get stories that passed but are not merged
prd_get_unmerged_passed() {
  jq -r '.stories[] | select(.passes == true and .merged != true) | .id' "$PRD_FILE"
}

# Get branch name for a story (for resuming merge)
prd_get_story_branch() {
  local story_id="$1"
  prd_get_branch_name "$story_id"
}

# Get dependency info for a story (formatted for display)
prd_get_story_deps() {
  local story_id="$1"
  local deps
  deps=$(jq -r ".stories[] | select(.id == \"$story_id\") | .depends_on // [] | .[]" "$PRD_FILE")

  if [[ -z "$deps" ]]; then
    echo "None (this story has no dependencies)"
    return
  fi

  while IFS= read -r did; do
    [[ -z "$did" ]] && continue
    local dep_info
    dep_info=$(jq -r ".stories[] | select(.id == \"$did\") | \"\(.title)|\(.passes // false)|\(.merged // false)\"" "$PRD_FILE")

    local title passes merged status
    IFS='|' read -r title passes merged <<< "$dep_info"

    if [[ "$merged" == "true" ]]; then
      status="MERGED"
    elif [[ "$passes" == "true" ]]; then
      status="PASSED (not merged)"
    else
      status="PENDING"
    fi

    echo "- $did: $title [$status]"
  done <<< "$deps"
}
