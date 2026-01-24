#!/usr/bin/env bash
# Activity log operations for Ralph

# Activity directory path (set by init)
ACTIVITY_DIR=""

# Initialize with project root
activity_init() {
  local project_root="$1"
  ACTIVITY_DIR="$project_root/docs/activity"

  # Create directory if it doesn't exist
  mkdir -p "$ACTIVITY_DIR/archive"
}

# Get recent activity logs (up to 2 most recent)
activity_get_recent_logs() {
  # Check if directory exists
  if [[ ! -d "$ACTIVITY_DIR" ]]; then
    echo "No activity logs found."
    return
  fi

  # Find all YYYY-MM-DD.md files, excluding README
  local log_files=()
  while IFS= read -r -d '' file; do
    local basename
    basename=$(basename "$file")
    if [[ "$basename" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}\.md$ ]]; then
      log_files+=("$basename")
    fi
  done < <(find "$ACTIVITY_DIR" -maxdepth 1 -name "*.md" -type f -print0 2>/dev/null)

  if [[ ${#log_files[@]} -eq 0 ]]; then
    echo "No activity logs found."
    return
  fi

  # Sort files (alphabetically = chronologically for YYYY-MM-DD format)
  IFS=$'\n' sorted_files=($(sort <<< "${log_files[*]}")); unset IFS

  # Take up to last 2 files (most recent)
  local num_files=${#sorted_files[@]}
  local start_idx=0
  if [[ $num_files -gt 2 ]]; then
    start_idx=$((num_files - 2))
  fi

  # Read and output each file with header
  for ((i=start_idx; i<num_files; i++)); do
    local f="${sorted_files[$i]}"
    local full_path="$ACTIVITY_DIR/$f"
    echo "=== Activity Log: $f ==="
    echo ""
    cat "$full_path"
    echo ""
    echo "---"
    echo ""
  done
}

# Get today's activity log path
activity_get_today_path() {
  local today
  today=$(date '+%Y-%m-%d')
  echo "$ACTIVITY_DIR/$today.md"
}

# Initialize today's log if it doesn't exist
activity_init_today() {
  local today_path
  today_path=$(activity_get_today_path)

  if [[ ! -f "$today_path" ]]; then
    local today
    today=$(date '+%Y-%m-%d')
    cat > "$today_path" << EOF
# Activity Log - $today

EOF
  fi
}

# Add entry to today's log
activity_log_entry() {
  local message="$1"
  local story_id="$2"

  activity_init_today

  local today_path
  today_path=$(activity_get_today_path)
  local timestamp
  timestamp=$(date '+%H:%M')

  {
    echo ""
    echo "## $timestamp - $message"
    if [[ -n "$story_id" ]]; then
      echo "Story: $story_id"
    fi
  } >> "$today_path"
}
