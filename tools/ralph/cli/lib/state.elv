# State management for Ralph

use path
use ./ui
use ./prd

# State file path (set by init)
var state-file = ""
var project-root = ""

# Initialize with state file path
fn init {|path &root=""|
  set state-file = $path
  set project-root = $root

  # Create state file if missing
  if (not (path:is-regular $state-file)) {
    echo '{"version":1,"current_story":null,"status":"idle","branch":null,"pr_url":null,"started_at":null,"last_updated":null,"attempts":0,"error":null,"last_error":null,"failure_count":0,"checkpoints":[]}' > $state-file
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
    &pr_url=$nil
    &started_at=$nil
    &last_updated=$nil
    &attempts=(num 0)
    &error=$nil
    &last_error=$nil
    &failure_count=(num 0)
    &checkpoints=[]
  ]
  write $state
}

# Record a failure with error message
fn record-failure {|error-msg|
  var state = (read)
  var prev-error = ""
  if (has-key $state last_error) {
    set prev-error = $state[last_error]
  }

  # Increment failure count if same error, reset if different
  var fc = (num 0)
  if (has-key $state failure_count) {
    set fc = $state[failure_count]
  }

  if (eq $error-msg $prev-error) {
    set fc = (+ $fc 1)
  } else {
    set fc = (num 1)
  }

  set state[last_error] = $error-msg
  set state[failure_count] = $fc
  write $state
  put $fc
}

# Clear failure tracking (on success or story change)
fn clear-failure {
  var state = (read)
  set state[last_error] = $nil
  set state[failure_count] = (num 0)
  write $state
}

# Get current failure info
fn get-failure-info {
  var state = (read)
  var error = $nil
  var count = (num 0)
  if (has-key $state last_error) {
    set error = $state[last_error]
  }
  if (has-key $state failure_count) {
    set count = $state[failure_count]
  }
  put [&error=$error &count=$count]
}

# Save a checkpoint for a story at a specific stage
fn save-checkpoint {|story-id stage data|
  var state = (read)
  var checkpoint = [
    &story_id=$story-id
    &stage=$stage
    &at=(date -u '+%Y-%m-%dT%H:%M:%SZ')
    &attempt=$state[attempts]
    &data=$data
  ]
  # Replace same-stage checkpoint, keep others
  var new-cps = []
  for cp $state[checkpoints] {
    if (or (not (eq $cp[story_id] $story-id)) (not (eq $cp[stage] $stage))) {
      set new-cps = [$@new-cps $cp]
    }
  }
  set state[checkpoints] = [$@new-cps $checkpoint]
  write $state
}

# Get a checkpoint for a story at a specific stage
fn get-checkpoint {|story-id stage|
  var state = (read)
  for cp $state[checkpoints] {
    if (and (eq $cp[story_id] $story-id) (eq $cp[stage] $stage)) {
      put $cp
      return
    }
  }
  put $nil
}

# Check if a checkpoint exists for a story at a specific stage
fn has-checkpoint {|story-id stage|
  not (eq (get-checkpoint $story-id $stage) $nil)
}

# Clear all checkpoints for a story
fn clear-checkpoints {|story-id|
  var state = (read)
  var new-cps = []
  for cp $state[checkpoints] {
    if (not (eq $cp[story_id] $story-id)) {
      set new-cps = [$@new-cps $cp]
    }
  }
  set state[checkpoints] = $new-cps
  write $state
}

# Handle retry-clean mode: delete branches and reset story for fresh retry
fn handle-retry-clean {|story-id|
  ui:status "Retry clean: "$story-id

  # Get branch name for story
  var branch-name = ""
  try {
    set branch-name = (prd:get-branch-name $story-id)
  } catch _ { }

  # Delete local branch if exists
  if (not (eq $branch-name "")) {
    ui:dim "  Deleting local branch: "$branch-name
    try {
      git -C $project-root branch -D $branch-name 2>/dev/null
    } catch _ { }

    # Delete remote branch if exists
    ui:dim "  Deleting remote branch: "$branch-name
    try {
      git -C $project-root push origin --delete $branch-name 2>/dev/null
    } catch _ { }
  }

  # Reset story in prd.json
  ui:dim "  Resetting story state in PRD"
  prd:reset-story $story-id

  # Clear checkpoints for this story
  ui:dim "  Clearing checkpoints"
  clear-checkpoints $story-id

  # Clear failure tracking
  ui:dim "  Clearing failure tracking"
  clear-failure

  # Clear state.json
  ui:dim "  Clearing Ralph state"
  reset

  ui:success "Story "$story-id" reset for fresh retry"
  ui:dim "Run ./ralph.elv to start fresh"
}
