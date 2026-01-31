# Gotchas file management for Ralph
# Handles metadata tracking and periodic compaction

use str
use re
use path
use ./ui
use ./prd

# Configuration
var project-root = ""
var gotchas-dir = ""
var base-branch = "dev"
var compaction-threshold-days = 30

# Run Claude with temp file for reliable prompt handling
# (Local copy to avoid circular dependency with claude.elv)
fn run-claude {|prompt|
  var prompt-file = (mktemp -t claude-prompt-XXXXXX)
  echo $prompt > $prompt-file

  var output = ""
  var success = $true
  var err = ""

  try {
    set output = (claude --dangerously-skip-permissions --print < $prompt-file 2>&1 | slurp)
  } catch e {
    set success = $false
    set err = (to-string $e[reason])
  } finally {
    rm -f $prompt-file
  }

  put [&success=$success &output=$output &error=$err]
}

# Initialize module
fn init {|root &base="dev"|
  set project-root = $root
  set gotchas-dir = (path:join $root "docs" "gotchas")
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

# Get list of files that need compaction from a directory
fn get-files-needing-compaction-in {|dir|
  var files = []

  if (not (path:is-dir $dir)) {
    put $files
    return
  }

  for file [(path:join $dir "*.md" | each {|p|
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

# Compact a single file using Claude
# type: "gotchas" or "knowledge"
fn compact-file {|file-path type|
  var filename = (path:base $file-path)
  ui:status "Compacting "$filename"..."

  var content = (cat $file-path 2>/dev/null | slurp)

  # Strip existing metadata for the prompt
  set content = (echo $content | sed '/^---$/,/<!-- lastCompactedAt:/d' | str:trim-space (slurp))

  var prompt = ""
  if (eq $type "knowledge") {
    set prompt = 'You are restructuring a knowledge base document. Your goal is to improve organization and readability - NOT to reduce content.

FILE: '$filename'

CURRENT CONTENT:
'$content'

TASK:
1. Restructure for logical flow (overview/TL;DR first, then details)
2. Group related content under clear headers
3. Move scattered information to appropriate sections
4. Improve headers for scannability (## for main topics, ### for subtopics)
5. Keep ALL code examples and commands - do not remove any
6. Add brief introductions to sections if missing
7. Ensure consistent formatting throughout
8. Remove only truly redundant/duplicate content (same info repeated)

This is RESTRUCTURING, not reduction. Preserve all information, just organize it better.

Output ONLY the restructured content (no explanations, no metadata). Start directly with the first header.'
  } else {
    set prompt = 'You are consolidating a gotchas document. Your goal is to make it more concise and organized while preserving all valuable pitfall information.

FILE: '$filename'

CURRENT CONTENT:
'$content'

TASK:
1. Merge similar or related entries
2. Remove redundant or outdated information
3. Improve organization and flow
4. Keep the same markdown structure (headers, code blocks, etc.)
5. Preserve all genuinely useful, non-obvious pitfalls
6. Keep it concise - aim for 20-30% reduction if possible without losing value

Output ONLY the compacted content (no explanations, no metadata). Start directly with the first header or content.'
  }

  var claude-result = (run-claude $prompt)
  if (not $claude-result[success]) {
    ui:warn "Compaction failed for "$filename": "$claude-result[error]
    return
  }
  var result = $claude-result[output]

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
  var knowledge-dir = (path:join $project-root "docs" "knowledge")

  # Check knowledge files
  var knowledge-files = (get-files-needing-compaction-in $knowledge-dir)
  if (> (count $knowledge-files) 0) {
    ui:banner "Knowledge Base Restructuring"
    ui:dim "Found "(count $knowledge-files)" knowledge file(s) due for restructuring"
    echo ""

    for file $knowledge-files {
      compact-file $file "knowledge"
    }
    echo ""
  }

  # Check gotchas files
  var gotcha-files = (get-files-needing-compaction-in $gotchas-dir)
  if (> (count $gotcha-files) 0) {
    ui:banner "Gotchas Compaction"
    ui:dim "Found "(count $gotcha-files)" gotcha file(s) due for compaction"
    echo ""

    for file $gotcha-files {
      compact-file $file "gotchas"
    }
    echo ""
  }
}

# Initialize metadata for all existing doc files (one-time setup)
fn init-all-metadata {
  var today = (date '+%Y-%m-%d')
  var knowledge-dir = (path:join $project-root "docs" "knowledge")

  # Initialize knowledge files
  if (path:is-dir $knowledge-dir) {
    for file [(ls $knowledge-dir"/"*.md 2>/dev/null)] {
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

  # Initialize gotchas files
  if (path:is-dir $gotchas-dir) {
    for file [(ls $gotchas-dir"/"*.md 2>/dev/null)] {
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
}

# Extract gotchas and knowledge from completed story
# Analyzes what was done and appends to docs/gotchas/ and docs/knowledge/
fn extract {|story-id branch-name|
  ui:status "Extracting knowledge and gotchas from story..."

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
    ui:dim "  No diff found, skipping extraction"
    return
  }

  # Get existing docs for context (to avoid duplicates)
  var knowledge-dir = (path:join $project-root "docs" "knowledge")
  var existing-knowledge = ""
  var knowledge-files = []
  if (path:is-dir $knowledge-dir) {
    try {
      set existing-knowledge = (cat $knowledge-dir"/"*.md 2>/dev/null | slurp)
      # Get list of actual files (excluding README)
      for f [(ls $knowledge-dir"/"*.md 2>/dev/null)] {
        var basename = (path:base $f)
        if (not (eq $basename "README.md")) {
          set knowledge-files = [$@knowledge-files $basename]
        }
      }
    } catch _ { }
  }

  var existing-gotchas = ""
  var gotcha-files = []
  if (path:is-dir $gotchas-dir) {
    try {
      set existing-gotchas = (cat $gotchas-dir"/"*.md 2>/dev/null | slurp)
      # Get list of actual files (excluding README)
      for f [(ls $gotchas-dir"/"*.md 2>/dev/null)] {
        var basename = (path:base $f)
        if (not (eq $basename "README.md")) {
          set gotcha-files = [$@gotcha-files $basename]
        }
      }
    } catch _ { }
  }

  # Build valid files lists from actual directory contents
  var knowledge-files-str = (str:join ", " $knowledge-files)
  var gotcha-files-str = (str:join ", " $gotcha-files)

  var prompt = 'Analyze this completed story and extract documentation updates and gotchas.

STORY: '$story-id'

ACTIVITY LOG:
'$activity'

CHANGES MADE (DIFF):
'$diff'

EXISTING KNOWLEDGE BASE (do not duplicate):
'$existing-knowledge'

EXISTING GOTCHAS (do not duplicate):
'$existing-gotchas'

Extract TWO types of content:

## 1. KNOWLEDGE (Product Documentation)
Document new features, workflows, or behaviors implemented. Write like documentation:
- How does this feature work?
- What commands/flags were added?
- What is the architecture or flow?

## 2. GOTCHAS (Pitfalls to Avoid)
Document mistakes, surprises, or non-obvious issues discovered:
- What went wrong and how was it fixed?
- What edge cases were discovered?
- What would trip up future developers?

Output format:

If nothing to extract:
<no-extractions/>

Otherwise, include any combination of:

<knowledge file="example.md">
## Feature Title

Documentation content...
</knowledge>

<gotcha file="example.md">
## Pitfall Title

What to avoid...
</gotcha>

Existing knowledge files: '$knowledge-files-str'
Existing gotcha files: '$gotcha-files-str'

You can use existing files OR create new ones if the topic deserves its own file.
New file names should be lowercase, descriptive, and end in .md (e.g., agents.md, auth.md, testing.md).

Only extract genuinely useful content. Be concise but complete.'

  var claude-result = (run-claude $prompt)
  if (not $claude-result[success]) {
    ui:warn "Extraction failed: "$claude-result[error]
    return
  }
  var result = $claude-result[output]

  if (str:contains $result "<no-extractions/>") {
    ui:dim "  No notable extractions from this story"
    return
  }

  var total-count = 0

  # Parse and apply knowledge (extract filenames from tags - allows new files)
  if (str:contains $result "<knowledge") {
    mkdir -p $knowledge-dir

    var count = 0
    # Extract all filenames from <knowledge file="X"> tags
    var found-files = [(echo $result | grep -o '<knowledge file="[^"]*">' | sed 's/<knowledge file="//; s/">//' | sort -u)]
    for file $found-files {
      # Validate filename (must end in .md, no path traversal)
      if (and (str:has-suffix $file ".md") (not (str:contains $file "/"))) {
        try {
          var content = (echo $result | sed -n '/<knowledge file="'$file'">/,/<\/knowledge>/p' | sed '1d;$d')
          if (not (eq (str:trim-space $content) "")) {
            var target = (path:join $knowledge-dir $file)
            if (not (path:is-regular $target)) {
              # New file - create with header
              var title = (echo $file | sed 's/\.md$//; s/-/ /g; s/\b\(.\)/\u\1/g')
              echo "# "$title" Knowledge" > $target
              echo "" >> $target
              ui:dim "  Created new knowledge file: "$file
            }
            echo "" >> $target
            echo $content >> $target
            mark-updated $target
            set count = (+ $count 1)
          }
        } catch _ { }
      }
    }

    if (> $count 0) {
      ui:success "  Extracted "$count" knowledge doc(s)"
      set total-count = (+ $total-count $count)
    }
  }

  # Parse and apply gotchas (extract filenames from tags - allows new files)
  if (str:contains $result "<gotcha") {
    mkdir -p $gotchas-dir

    var count = 0
    # Extract all filenames from <gotcha file="X"> tags
    var found-files = [(echo $result | grep -o '<gotcha file="[^"]*">' | sed 's/<gotcha file="//; s/">//' | sort -u)]
    for file $found-files {
      # Validate filename (must end in .md, no path traversal)
      if (and (str:has-suffix $file ".md") (not (str:contains $file "/"))) {
        try {
          var content = (echo $result | sed -n '/<gotcha file="'$file'">/,/<\/gotcha>/p' | sed '1d;$d')
          if (not (eq (str:trim-space $content) "")) {
            var target = (path:join $gotchas-dir $file)
            if (not (path:is-regular $target)) {
              # New file - create with header
              var title = (echo $file | sed 's/\.md$//; s/-/ /g; s/\b\(.\)/\u\1/g')
              echo "# "$title" Gotchas" > $target
              echo "" >> $target
              ui:dim "  Created new gotcha file: "$file
            }
            echo "" >> $target
            echo $content >> $target
            mark-updated $target
            set count = (+ $count 1)
          }
        } catch _ { }
      }
    }

    if (> $count 0) {
      ui:success "  Extracted "$count" gotcha(s)"
      set total-count = (+ $total-count $count)
    }
  }

  if (== $total-count 0) {
    ui:dim "  No extractions parsed"
  }
}

# Extract micro-learning from a feedback loop
# Called after feedback round succeeds - captures "what was wrong → what fixed it" pattern
fn extract-feedback-learning {|story-id feedback branch-name|
  ui:status "Extracting fix pattern from feedback loop..."

  # Get the diff of changes made after feedback
  var diff = ""
  try {
    # Get last 2 commits (the fix commit and the one before)
    var commits = [(git -C $project-root log --oneline -2 --format="%H" $branch-name 2>/dev/null)]
    if (>= (count $commits) 2) {
      set diff = (git -C $project-root diff $commits[1]".."$commits[0] 2>/dev/null | slurp)
    }
  } catch _ { }

  if (eq $diff "") {
    ui:dim "  No diff found, skipping feedback extraction"
    return
  }

  # Get story title for context
  var story-title = (prd:get-story-title $story-id)

  var prompt = 'Extract a "fix pattern" gotcha from this feedback loop.

STORY: '$story-id' - '$story-title'

USER FEEDBACK (what was wrong):
'$feedback'

CHANGES MADE TO FIX (diff):
'$diff'

This is a feedback loop pattern: user identified something wrong, developer fixed it.
These patterns are valuable because they capture real mistakes and their solutions.

Extract a concise gotcha that could help avoid this mistake in the future.
Focus on:
- What the symptom was (from feedback)
- What the actual issue was (from the fix)
- How to avoid it or fix it

Output format:

If not a reusable pattern (too specific to this story):
<no-extraction/>

Otherwise:
<gotcha file="appropriate-topic.md">
### Problem Brief Title

**Symptom:** What went wrong or what user complained about

**Cause:** Why it happened

**Fix:** How to avoid or fix it

```code-example-if-relevant```
</gotcha>

Be concise. Only extract if this is genuinely reusable knowledge.'

  var claude-result = (run-claude $prompt)
  if (not $claude-result[success]) {
    ui:warn "Feedback extraction failed: "$claude-result[error]
    return
  }
  var result = $claude-result[output]

  if (str:contains $result "<no-extraction/>") {
    ui:dim "  Feedback was story-specific, no reusable pattern"
    return
  }

  # Parse and apply gotcha
  if (str:contains $result "<gotcha") {
    mkdir -p $gotchas-dir

    var found-files = [(echo $result | grep -o '<gotcha file="[^"]*">' | sed 's/<gotcha file="//; s/">//' | sort -u)]
    for file $found-files {
      if (and (str:has-suffix $file ".md") (not (str:contains $file "/"))) {
        try {
          var content = (echo $result | sed -n '/<gotcha file="'$file'">/,/<\/gotcha>/p' | sed '1d;$d')
          if (not (eq (str:trim-space $content) "")) {
            var target = (path:join $gotchas-dir $file)
            if (not (path:is-regular $target)) {
              var title = (echo $file | sed 's/\.md$//; s/-/ /g; s/\b\(.\)/\u\1/g')
              echo "# "$title" Gotchas" > $target
              echo "" >> $target
              ui:dim "  Created new gotcha file: "$file
            }
            echo "" >> $target
            echo "<!-- From feedback loop on "$story-id" -->" >> $target
            echo $content >> $target
            mark-updated $target
            ui:success "  Extracted fix pattern to "$file
          }
        } catch _ { }
      }
    }
  } else {
    ui:dim "  No fix pattern extracted"
  }
}
