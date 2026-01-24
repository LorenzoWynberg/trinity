# State management for Ralph

use path

# State file path (set by init)
var state-file = ""

# Initialize with state file path
fn init {|path|
  set state-file = $path

  # Create state file if missing
  if (not (path:is-regular $state-file)) {
    echo '{"version":1,"current_story":null,"status":"idle","branch":null,"started_at":null,"last_updated":null,"attempts":0,"error":null,"checkpoints":[]}' > $state-file
  }
}

# Read state from file
fn read {
  cat $state-file | from-json
}

# Write state to file
fn write {|state|
  var timestamp = (date -u '+%Y-%m-%dT%H:%M:%SZ')
  set state[last_updated] = $timestamp
  put $state | to-json > $state-file
}

# Reset state to initial values
fn reset {
  var state = [
    &version=(num 1)
    &current_story=$nil
    &status="idle"
    &branch=$nil
    &started_at=$nil
    &last_updated=$nil
    &attempts=(num 0)
    &error=$nil
    &checkpoints=[]
  ]
  write $state
}
