# Metrics tracking for Ralph
# Tracks tokens, durations, and costs per story

use str
use path

# Metrics file path (set by init)
var metrics-file = ""

# Initialize with metrics file path
fn init {|path|
  set metrics-file = $path

  # Create metrics file if doesn't exist
  if (not (path:is-regular $metrics-file)) {
    echo '{
  "total_tokens": 0,
  "total_input_tokens": 0,
  "total_output_tokens": 0,
  "total_duration_seconds": 0,
  "stories_completed": 0,
  "stories": []
}' > $metrics-file
  }
}

# Record metrics for a completed story
fn record {|story-id duration-seconds input-tokens output-tokens|
  var timestamp = (date -u '+%Y-%m-%dT%H:%M:%SZ')
  var total-tokens = (+ $input-tokens $output-tokens)

  # Update metrics file
  var tmp = (mktemp)
  jq '
    .total_tokens += '$total-tokens' |
    .total_input_tokens += '$input-tokens' |
    .total_output_tokens += '$output-tokens' |
    .total_duration_seconds += '$duration-seconds' |
    .stories_completed += 1 |
    .stories += [{
      "story_id": "'$story-id'",
      "timestamp": "'$timestamp'",
      "duration_seconds": '$duration-seconds',
      "input_tokens": '$input-tokens',
      "output_tokens": '$output-tokens',
      "total_tokens": '$total-tokens'
    }]
  ' $metrics-file > $tmp
  mv $tmp $metrics-file
}

# Extract tokens from Claude stream-json output file
# Returns: [&input=N &output=N] or [&input=0 &output=0] if not found
fn extract-tokens-from-output {|output-file|
  var input = 0
  var output = 0

  try {
    # Look for usage info in stream-json output
    # Format: {"type":"result","result":"...","usage":{"input_tokens":N,"output_tokens":N}}
    var usage = (jq -s 'map(select(.usage)) | last | .usage // {}' $output-file 2>/dev/null | slurp)
    if (not (eq $usage "{}")) {
      set input = (echo $usage | jq -r '.input_tokens // 0')
      set output = (echo $usage | jq -r '.output_tokens // 0')
    }
  } catch _ { }

  put [&input=(num $input) &output=(num $output)]
}

# Show metrics summary
fn show-stats {
  if (not (path:is-regular $metrics-file)) {
    echo "No metrics recorded yet."
    return
  }

  var metrics = (cat $metrics-file | slurp)

  var total = (echo $metrics | jq -r '.total_tokens')
  var input = (echo $metrics | jq -r '.total_input_tokens')
  var output = (echo $metrics | jq -r '.total_output_tokens')
  var duration = (echo $metrics | jq -r '.total_duration_seconds')
  var stories = (echo $metrics | jq -r '.stories_completed')

  # Calculate averages
  var avg-tokens = 0
  var avg-duration = 0
  if (> $stories 0) {
    set avg-tokens = (/ $total $stories)
    set avg-duration = (/ $duration $stories)
  }

  # Format duration
  var hours = (/ $duration 3600)
  var mins = (% (/ $duration 60) 60)

  echo "═══════════════════════════════════════════════════════"
  echo "  RALPH METRICS"
  echo "═══════════════════════════════════════════════════════"
  echo ""
  echo "Stories completed:  "$stories
  echo "Total time:         "$hours"h "$mins"m"
  echo ""
  echo "Token usage:"
  echo "  Total:            "$total
  echo "  Input:            "$input
  echo "  Output:           "$output
  echo ""
  echo "Averages per story:"
  echo "  Tokens:           "$avg-tokens
  echo "  Duration:         "$avg-duration"s"
  echo ""

  # Show recent stories
  echo "───────────────────────────────────────────────────────"
  echo "  RECENT STORIES"
  echo "───────────────────────────────────────────────────────"

  var recent = (echo $metrics | jq -r '.stories | .[-5:] | reverse | .[] | "\(.story_id)|\(.duration_seconds)|\(.total_tokens)"')
  for line [(str:split "\n" $recent)] {
    if (not (eq $line "")) {
      var parts = [(str:split "|" $line)]
      var sid = $parts[0]
      var dur = $parts[1]
      var tok = $parts[2]
      echo "  "$sid": "$dur"s, "$tok" tokens"
    }
  }
  echo ""
  echo "═══════════════════════════════════════════════════════"
}
