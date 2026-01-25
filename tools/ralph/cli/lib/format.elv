# Code formatting for Ralph
# Handles formatting of various file types

use path
use ./ui

# Configuration
var project-root = ""

# Initialize module
fn init {|root|
  set project-root = $root
}

# Get modified files of a specific type from git
fn get-modified-files {|extension|
  try {
    var files = [(git -C $project-root diff --name-only HEAD~1 2>/dev/null | grep '\.'$extension'$')]
    put $@files
  } catch {
    # No files or error
  }
}

# Format Go files with gofmt
fn go-files {
  ui:status "Formatting Go files..."
  try {
    var go-files = [(get-modified-files "go")]
    if (> (count $go-files) 0) {
      for f $go-files {
        try { gofmt -w (path:join $project-root $f) 2>/dev/null } catch _ { }
      }
      ui:success "  Formatted "(count $go-files)" Go file(s)"
    } else {
      ui:dim "  No Go files to format"
    }
  } catch {
    ui:dim "  (no modified files)"
  }
}

# Format all supported file types
fn all {
  go-files
  # Future: add more formatters here
  # js-files   # prettier
  # py-files   # black
  # etc.
}
