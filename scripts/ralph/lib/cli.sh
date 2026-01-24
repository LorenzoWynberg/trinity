#!/usr/bin/env bash
# CLI argument parsing and validation for Ralph

# Configuration (populated by parse_args)
MAX_ITERATIONS=100
BASE_BRANCH="dev"
QUIET_MODE=false
CLAUDE_TIMEOUT=1800
AUTO_PR=false
AUTO_MERGE=false
RESUME_MODE=false
RESET_MODE=false

# Parse command line arguments
cli_parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help)
        ui_show_help
        exit 0
        ;;
      --max-iterations)
        if [[ -z "$2" ]]; then
          echo "Error: --max-iterations requires a number" >&2
          exit 1
        fi
        MAX_ITERATIONS="$2"
        shift 2
        ;;
      --base-branch)
        if [[ -z "$2" ]]; then
          echo "Error: --base-branch requires a branch name" >&2
          exit 1
        fi
        BASE_BRANCH="$2"
        shift 2
        ;;
      --resume)
        RESUME_MODE=true
        shift
        ;;
      --reset)
        RESET_MODE=true
        shift
        ;;
      -q|--quiet)
        QUIET_MODE=true
        shift
        ;;
      --auto-pr)
        AUTO_PR=true
        shift
        ;;
      --auto-merge)
        AUTO_MERGE=true
        shift
        ;;
      *)
        echo "Error: Unknown argument: $1" >&2
        exit 1
        ;;
    esac
  done
}

# Check for required external commands
cli_check_dependencies() {
  local missing=()
  for cmd in jq git claude go gh timeout; do
    if ! command -v "$cmd" &>/dev/null; then
      # On macOS, timeout might be gtimeout
      if [[ "$cmd" == "timeout" ]] && command -v gtimeout &>/dev/null; then
        continue
      fi
      missing+=("$cmd")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    ui_error "Required commands not found: ${missing[*]}"
    exit 1
  fi
  ui_dim "Dependencies: jq, git, claude, go, gh ✓"
}

# Validate required files exist
cli_check_files() {
  for file in "$@"; do
    if [[ ! -f "$file" ]]; then
      echo "Error: Required file not found: $file" >&2
      exit 1
    fi
  done
  ui_dim "Config files: prompt.md, prd.json, progress.txt ✓"
}

# Get timeout command (gtimeout on macOS)
get_timeout_cmd() {
  if command -v timeout &>/dev/null; then
    echo "timeout"
  elif command -v gtimeout &>/dev/null; then
    echo "gtimeout"
  else
    echo "timeout"
  fi
}
