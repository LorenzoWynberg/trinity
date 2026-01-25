# CLI argument parsing and validation for Ralph

use path
use ./ui

# Configuration (populated by parse-args)
var max-iterations = 100
var base-branch = "dev"
var quiet-mode = $false
var claude-timeout = 1800
var auto-pr = $false
var auto-merge = $false
var resume-mode = $false
var reset-mode = $false
var no-validate = $false
var notify-enabled = $false
var skip-story-id = ""
var skip-reason = ""
var custom-timeout = 0
var retry-clean-story = ""
var verbose-mode = $false
var status-mode = $false
var plan-mode = $false
var stats-mode = $false
var version-status-mode = $false
var target-version = ""
var skip-release = $false
var auto-release = $false
var release-tag = ""

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
    } elif (eq $arg "--auto-pr") {
      set auto-pr = $true
      set i = (+ $i 1)
    } elif (eq $arg "--auto-merge") {
      set auto-merge = $true
      set i = (+ $i 1)
    } elif (eq $arg "--no-validate") {
      set no-validate = $true
      set i = (+ $i 1)
    } elif (eq $arg "--yolo") {
      # YOLO mode: no validation, auto PR, auto merge
      set no-validate = $true
      set auto-pr = $true
      set auto-merge = $true
      set i = (+ $i 1)
    } elif (eq $arg "--notify") {
      set notify-enabled = $true
      set i = (+ $i 1)
    } elif (eq $arg "--skip") {
      # --skip STORY-X "reason"
      var next-idx = (+ $i 1)
      var reason-idx = (+ $i 2)
      if (>= $reason-idx (count $arguments)) {
        echo "Error: --skip requires STORY-ID and \"reason\"" >&2
        exit 1
      }
      set skip-story-id = $arguments[$next-idx]
      set skip-reason = $arguments[$reason-idx]
      set i = (+ $i 3)
    } elif (eq $arg "--timeout") {
      var next-idx = (+ $i 1)
      if (>= $next-idx (count $arguments)) {
        echo "Error: --timeout requires a number (seconds)" >&2
        exit 1
      }
      set custom-timeout = (num $arguments[$next-idx])
      set claude-timeout = $custom-timeout
      set i = (+ $i 2)
    } elif (eq $arg "--retry-clean") {
      var next-idx = (+ $i 1)
      if (>= $next-idx (count $arguments)) {
        echo "Error: --retry-clean requires STORY-ID" >&2
        exit 1
      }
      set retry-clean-story = $arguments[$next-idx]
      set i = (+ $i 2)
    } elif (or (eq $arg "-v") (eq $arg "--verbose")) {
      set verbose-mode = $true
      set i = (+ $i 1)
    } elif (eq $arg "--status") {
      set status-mode = $true
      set i = (+ $i 1)
    } elif (eq $arg "--plan") {
      set plan-mode = $true
      set i = (+ $i 1)
    } elif (eq $arg "--stats") {
      set stats-mode = $true
      set i = (+ $i 1)
    } elif (eq $arg "--version-status") {
      set version-status-mode = $true
      set i = (+ $i 1)
    } elif (eq $arg "--target-version") {
      var next-idx = (+ $i 1)
      if (>= $next-idx (count $arguments)) {
        echo "Error: --target-version requires a version (e.g., v1.0)" >&2
        exit 1
      }
      set target-version = $arguments[$next-idx]
      set i = (+ $i 2)
    } elif (eq $arg "--skip-release") {
      set skip-release = $true
      set i = (+ $i 1)
    } elif (eq $arg "--auto-release") {
      set auto-release = $true
      set i = (+ $i 1)
    } elif (eq $arg "--release-tag") {
      var next-idx = (+ $i 1)
      if (>= $next-idx (count $arguments)) {
        echo "Error: --release-tag requires a tag name (e.g., v1.0.0)" >&2
        exit 1
      }
      set release-tag = $arguments[$next-idx]
      set i = (+ $i 2)
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
    &no-validate=$no-validate
    &notify-enabled=$notify-enabled
    &skip-story-id=$skip-story-id
    &skip-reason=$skip-reason
    &retry-clean-story=$retry-clean-story
    &verbose-mode=$verbose-mode
    &status-mode=$status-mode
    &plan-mode=$plan-mode
    &stats-mode=$stats-mode
    &version-status-mode=$version-status-mode
    &target-version=$target-version
    &skip-release=$skip-release
    &auto-release=$auto-release
    &release-tag=$release-tag
  ]
}
