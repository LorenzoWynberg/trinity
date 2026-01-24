# CLI argument parsing and validation for Ralph

use path
use ./ui

# Configuration (populated by parse-args)
var max-iterations = 100
var base-branch = "dev"
var quiet-mode = $false
var claude-timeout = 1800
var auto-pr = $true
var auto-merge = $false
var resume-mode = $false
var reset-mode = $false

# Parse command line arguments
fn parse-args {|arguments|
  var i = 0

  while (< $i (count $arguments)) {
    var arg = $arguments[$i]

    if (or (eq $arg "-h") (eq $arg "--help")) {
      ui:show-help
      exit 0
    } elif (eq $arg "--max-iterations") {
      var next-idx = (+ $i 1)
      if (>= $next-idx (count $arguments)) {
        echo "Error: --max-iterations requires a number" >&2
        exit 1
      }
      set max-iterations = (num $arguments[$next-idx])
      set i = (+ $i 2)
    } elif (eq $arg "--base-branch") {
      var next-idx = (+ $i 1)
      if (>= $next-idx (count $arguments)) {
        echo "Error: --base-branch requires a branch name" >&2
        exit 1
      }
      set base-branch = $arguments[$next-idx]
      set i = (+ $i 2)
    } elif (eq $arg "--resume") {
      set resume-mode = $true
      set i = (+ $i 1)
    } elif (eq $arg "--reset") {
      set reset-mode = $true
      set i = (+ $i 1)
    } elif (or (eq $arg "-q") (eq $arg "--quiet")) {
      set quiet-mode = $true
      set i = (+ $i 1)
    } elif (eq $arg "--no-auto-pr") {
      set auto-pr = $false
      set i = (+ $i 1)
    } elif (eq $arg "--auto-merge") {
      set auto-merge = $true
      set i = (+ $i 1)
    } else {
      echo "Error: Unknown argument: "$arg >&2
      exit 1
    }
  }
}

# Check for required external commands
fn check-dependencies {
  for cmd [jq git claude go gh] {
    if (not (has-external $cmd)) {
      ui:error "Required command '"$cmd"' not found in PATH"
      exit 1
    }
  }
  ui:dim "Dependencies: jq, git, claude, go, gh ✓"
}

# Validate required files exist
fn check-files {|@files|
  for file $files {
    if (not (path:is-regular $file)) {
      echo "Error: Required file not found: "$file >&2
      exit 1
    }
  }
  ui:dim "Config files: prompt.md, prd.json, progress.txt ✓"
}

# Get config as map (for passing to modules)
fn get-config {
  put [
    &max-iterations=$max-iterations
    &base-branch=$base-branch
    &quiet-mode=$quiet-mode
    &claude-timeout=$claude-timeout
    &auto-pr=$auto-pr
    &auto-merge=$auto-merge
    &resume-mode=$resume-mode
    &reset-mode=$reset-mode
  ]
}
