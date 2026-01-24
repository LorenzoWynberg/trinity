#!/usr/bin/env bash
# State management for Ralph

# State file path (set by init)
STATE_FILE=""

# Initialize with state file path
state_init() {
  STATE_FILE="$1"

  # Create state file if missing
  if [[ ! -f "$STATE_FILE" ]]; then
    echo '{"version":1,"current_story":null,"status":"idle","branch":null,"started_at":null,"last_updated":null,"attempts":0,"error":null,"checkpoints":[]}' > "$STATE_FILE"
  fi
}

# Read state field
state_get() {
  local field="$1"
  jq -r ".$field // empty" "$STATE_FILE"
}

# Read entire state as JSON
state_read_json() {
  cat "$STATE_FILE"
}

# Update state field
state_set() {
  local field="$1"
  local value="$2"
  local tmp
  tmp=$(mktemp)

  # Update last_updated timestamp
  local timestamp
  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

  # Handle null values and strings
  if [[ "$value" == "null" ]]; then
    jq ".$field = null | .last_updated = \"$timestamp\"" "$STATE_FILE" > "$tmp"
  elif [[ "$value" =~ ^[0-9]+$ ]]; then
    jq ".$field = $value | .last_updated = \"$timestamp\"" "$STATE_FILE" > "$tmp"
  elif [[ "$value" == "true" || "$value" == "false" ]]; then
    jq ".$field = $value | .last_updated = \"$timestamp\"" "$STATE_FILE" > "$tmp"
  else
    jq ".$field = \"$value\" | .last_updated = \"$timestamp\"" "$STATE_FILE" > "$tmp"
  fi

  mv "$tmp" "$STATE_FILE"
}

# Update multiple state fields at once
state_update() {
  local tmp
  tmp=$(mktemp)
  local timestamp
  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

  # Start with current state
  cp "$STATE_FILE" "$tmp"

  # Apply each key=value pair
  while [[ $# -gt 0 ]]; do
    local field="${1%%=*}"
    local value="${1#*=}"

    if [[ "$value" == "null" ]]; then
      jq ".$field = null" "$tmp" > "$tmp.new" && mv "$tmp.new" "$tmp"
    elif [[ "$value" =~ ^[0-9]+$ ]]; then
      jq ".$field = $value" "$tmp" > "$tmp.new" && mv "$tmp.new" "$tmp"
    elif [[ "$value" == "true" || "$value" == "false" ]]; then
      jq ".$field = $value" "$tmp" > "$tmp.new" && mv "$tmp.new" "$tmp"
    else
      jq ".$field = \"$value\"" "$tmp" > "$tmp.new" && mv "$tmp.new" "$tmp"
    fi
    shift
  done

  # Set last_updated
  jq ".last_updated = \"$timestamp\"" "$tmp" > "$tmp.new" && mv "$tmp.new" "$tmp"
  mv "$tmp" "$STATE_FILE"
}

# Reset state to initial values
state_reset() {
  local timestamp
  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  cat > "$STATE_FILE" << EOF
{
  "version": 1,
  "current_story": null,
  "status": "idle",
  "branch": null,
  "started_at": null,
  "last_updated": "$timestamp",
  "attempts": 0,
  "error": null,
  "checkpoints": []
}
EOF
}
