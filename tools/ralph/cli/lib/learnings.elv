# Learnings file management for Ralph
# Handles metadata tracking and periodic compaction

use str
use re
use path
use ./ui
use ./prd

# Configuration
var project-root = ""
var learnings-dir = ""
var base-branch = "dev"
var compaction-threshold-days = 30

# Initialize module
fn init {|root &base="dev"|
  set project-root = $root
  set learnings-dir = (path:join $root "docs" "learnings")
  set base-branch = $base
}

# Parse metadata from learning file
# Returns map with updatedAt and lastCompactedAt (or empty strings if not found)
fn parse-metadata {|file-path|
  var updated = ""
  var compacted = ""

  try {
    var content = (cat $file-path 2>/dev/null | slurp)

    # Look for <!-- updatedAt: YYYY-MM-DD -->
    if (re:match '<!-- updatedAt: \d{4}-\d{2}-\d{2} -->' $content) {
      set updated = (echo $content | grep -o '<!-- updatedAt: [0-9-]* -->' | sed 's/<!-- updatedAt: //; s/ -->//')
    }

    # Look for <!-- lastCompactedAt: YYYY-MM-DD -->
    if (re:match '<!-- lastCompactedAt: \d{4}-\d{2}-\d{2} -->' $content) {
      set compacted = (echo $content | grep -o '<!-- lastCompactedAt: [0-9-]* -->' | sed 's/<!-- lastCompactedAt: //; s/ -->//')
    }
  } catch _ { }

  put [&updatedAt=$updated &lastCompactedAt=$compacted]
}

# Update metadata in a learning file
fn update-metadata {|file-path updated-date compacted-date|
  var content = (cat $file-path 2>/dev/null | slurp)
  var metadata-block = '
---
<!-- updatedAt: '$updated-date' -->
<!-- lastCompactedAt: '$compacted-date' -->'

  # Remove existing metadata block if present
  set content = (echo $content | sed '/^---$/,/<!-- lastCompactedAt:/d' | str:trim-space (slurp))

  # Append new metadata
  echo $content > $file-path
  echo $metadata-block >> $file-path
}

# Mark file as updated (set updatedAt to today)
fn mark-updated {|file-path|
  var today = (date '+%Y-%m-%d')
  var meta = (parse-metadata $file-path)
  var compacted = $meta[lastCompactedAt]
  if (eq $compacted "") {
    set compacted = $today  # First time, set both to today
  }
  update-metadata $file-path $today $compacted
}

# Calculate days between two dates (YYYY-MM-DD format)
fn days-between {|date1 date2|
  try {
    var ts1 = (date -j -f '%Y-%m-%d' $date1 '+%s' 2>/dev/null)
    var ts2 = (date -j -f '%Y-%m-%d' $date2 '+%s' 2>/dev/null)
    var diff = (- $ts2 $ts1)
    put (/ $diff 86400)
  } catch _ {
    # Fallback for Linux
    try {
      var ts1 = (date -d $date1 '+%s' 2>/dev/null)
      var ts2 = (date -d $date2 '+%s' 2>/dev/null)
      var diff = (- $ts2 $ts1)
      put (/ $diff 86400)
    } catch _ {
      put 0
    }
  }
}

# Check if a file needs compaction
# Returns true if: > 30 days since last compaction AND updated since compaction
fn needs-compaction {|file-path|
  var meta = (parse-metadata $file-path)
  var updated = $meta[updatedAt]
  var compacted = $meta[lastCompactedAt]

  # No metadata = never tracked, doesn't need compaction yet
  if (eq $updated "") {
    put $false
    return
  }

  # Never compacted = needs compaction if old enough
  if (eq $compacted "") {
    set compacted = "2020-01-01"  # Ancient date
  }

  var today = (date '+%Y-%m-%d')
  var days-since-compaction = (days-between $compacted $today)

  # Check threshold
  if (< $days-since-compaction $compaction-threshold-days) {
    put $false
    return
  }

  # Check if updated after last compaction
  var days-updated-to-compacted = (days-between $compacted $updated)
  if (> $days-updated-to-compacted 0) {
    put $true
  } else {
    put $false
  }
}

# Get list of files that need compaction
fn get-files-needing-compaction {
  var files = []

  if (not (path:is-dir $learnings-dir)) {
    put $files
    return
  }

  for file [(path:join $learnings-dir "*.md" | each {|p|
    try { put (ls $p 2>/dev/null) } catch _ { }
  })] {
    # Skip README
    if (str:has-suffix $file "README.md") {
      continue
    }

    if (needs-compaction $file) {
      set files = [$@files $file]
    }
  }

  put $files
}

# Compact a single learning file using Claude
fn compact-file {|file-path|
  var filename = (path:base $file-path)
  ui:status "Compacting "$filename"..."

  var content = (cat $file-path 2>/dev/null | slurp)

  # Strip existing metadata for the prompt
  set content = (echo $content | sed '/^---$/,/<!-- lastCompactedAt:/d' | str:trim-space (slurp))

  var prompt = 'You are consolidating a learnings document. Your goal is to make it more concise and organized while preserving all valuable information.

FILE: '$filename'

CURRENT CONTENT:
'$content'

TASK:
1. Merge similar or related entries
2. Remove redundant or outdated information
3. Improve organization and flow
4. Keep the same markdown structure (headers, code blocks, etc.)
5. Preserve all genuinely useful, non-obvious learnings
6. Keep it concise - aim for 20-30% reduction if possible without losing value

Output ONLY the compacted content (no explanations, no metadata). Start directly with the first header or content.'

  var result = ""
  try {
    set result = (echo $prompt | claude --dangerously-skip-permissions --print 2>/dev/null | slurp)
  } catch e {
    ui:warn "Compaction failed for "$filename": "(to-string $e[reason])
    return
  }

  if (eq (str:trim-space $result) "") {
    ui:warn "Empty result from compaction, keeping original"
    return
  }

  # Write compacted content
  var today = (date '+%Y-%m-%d')
  echo $result > $file-path
  update-metadata $file-path $today $today

  ui:success "Compacted "$filename
}

# Run compaction check and compact files if needed
# Called at Ralph startup
fn check-and-compact {
  var files = (get-files-needing-compaction)

  if (== (count $files) 0) {
    return
  }

  ui:banner "Learnings Compaction"
  ui:dim "Found "(count $files)" file(s) due for compaction"
  echo ""

  for file $files {
    compact-file $file
  }

  echo ""
}

# Initialize metadata for all existing learning files (one-time setup)
fn init-all-metadata {
  if (not (path:is-dir $learnings-dir)) {
    return
  }

  var today = (date '+%Y-%m-%d')

  for file [(ls $learnings-dir"/"*.md 2>/dev/null)] {
    # Skip README
    if (str:has-suffix $file "README.md") {
      continue
    }

    var meta = (parse-metadata $file)
    if (eq $meta[updatedAt] "") {
      ui:dim "Initializing metadata for "(path:base $file)
      update-metadata $file $today $today
    }
  }
}

# Extract learnings from completed story
# Analyzes what was done and appends to docs/learnings/
fn extract {|story-id branch-name|
  ui:status "Extracting learnings from story..."

  # Get story activity (from today's log)
  var activity = ""
  var today = (date '+%Y-%m-%d')
  var activity-file = (path:join $project-root "logs" "activity" "trinity" $today".md")
  if (path:is-regular $activity-file) {
    try {
      set activity = (cat $activity-file | slurp)
    } catch _ { }
  }

  # Get diff for this story
  var diff = ""
  try {
    set diff = (git -C $project-root diff $base-branch"..."$branch-name 2>/dev/null | slurp)
  } catch _ { }

  if (eq $diff "") {
    ui:dim "  No diff found, skipping learning extraction"
    return
  }

  # Get existing learnings for context (to avoid duplicates)
  var existing = ""
  if (path:is-dir $learnings-dir) {
    try {
      set existing = (cat $learnings-dir"/"*.md 2>/dev/null | slurp)
    } catch _ { }
  }

  var prompt = 'Analyze this completed story and extract learnings.

STORY: '$story-id'

ACTIVITY LOG:
'$activity'

CHANGES MADE (DIFF):
'$diff'

EXISTING LEARNINGS (do not duplicate these):
'$existing'

Look for:
- Gotchas or surprises encountered
- Patterns that would help future stories
- Project-specific conventions discovered
- Mistakes made and then corrected
- Non-obvious implementation details

Output format - choose ONE:

If nothing notable to learn:
<no-learnings/>

OR if there are learnings:
<learning file="gotchas.md">
## Title of Learning

Content to append...
</learning>

<learning file="patterns.md">
## Another Learning

More content...
</learning>

Valid files: gotchas.md, patterns.md, conventions.md

Only extract genuinely useful, non-obvious learnings. Be concise.'

  var result = ""
  try {
    set result = (echo $prompt | claude --dangerously-skip-permissions --print 2>/dev/null | slurp)
  } catch e {
    ui:warn "Learning extraction failed: "(to-string $e[reason])
    return
  }

  if (str:contains $result "<no-learnings/>") {
    ui:dim "  No notable learnings from this story"
    return
  }

  # Parse and apply learnings
  if (str:contains $result "<learning") {
    # Ensure learnings directory exists
    mkdir -p $learnings-dir

    # Extract each learning block and append to appropriate file
    # Simple parsing - look for <learning file="X"> ... </learning>
    var count = 0
    for file [gotchas.md patterns.md conventions.md] {
      var pattern = '<learning file="'$file'">'
      if (str:contains $result $pattern) {
        try {
          # Extract content between tags
          var content = (echo $result | sed -n '/<learning file="'$file'">/,/<\/learning>/p' | sed '1d;$d')
          if (not (eq (str:trim-space $content) "")) {
            var target = (path:join $learnings-dir $file)
            # Create file if doesn't exist
            if (not (path:is-regular $target)) {
              echo "# "$file > $target
              echo "" >> $target
            }
            echo "" >> $target
            echo $content >> $target
            # Mark file as updated for compaction tracking
            mark-updated $target
            set count = (+ $count 1)
          }
        } catch _ { }
      }
    }

    if (> $count 0) {
      ui:success "  Extracted "$count" learning(s)"
    } else {
      ui:dim "  No learnings parsed"
    }
  } else {
    ui:dim "  No learnings found in response"
  }
}
