#!/usr/bin/env bash
# UI helpers - colors and styled output for Ralph

# ANSI color codes
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_DIM="\033[2m"
C_CYAN="\033[36m"
C_GREEN="\033[32m"
C_YELLOW="\033[33m"
C_RED="\033[31m"
C_BLUE="\033[34m"

ui_banner() {
  echo -e "${C_CYAN}${C_BOLD}═══ RALPH ═══ $1${C_RESET}"
}

ui_status() {
  echo -e "${C_BLUE}► ${C_RESET}$1"
}

ui_success() {
  echo -e "${C_GREEN}${C_BOLD}✓ ${C_RESET}${C_GREEN}$1${C_RESET}"
}

ui_warn() {
  echo -e "${C_YELLOW}⚠ $1${C_RESET}"
}

ui_error() {
  echo -e "${C_RED}${C_BOLD}✗ $1${C_RESET}"
}

ui_dim() {
  echo -e "${C_DIM}$1${C_RESET}"
}

ui_divider() {
  echo -e "${C_DIM}────────────────── $1 ──────────────────${C_RESET}"
}

ui_divider_end() {
  echo -e "${C_DIM}───────────────────────────────────────────────────${C_RESET}"
}

ui_box() {
  local title="$1"
  local style="$2"
  local color="$C_CYAN"

  case "$style" in
    success) color="$C_GREEN" ;;
    warn) color="$C_YELLOW" ;;
  esac

  echo -e "${color}${C_BOLD}╔════════════════════════════════════════════════════════╗${C_RESET}"
  echo -e "${color}${C_BOLD}║  $title${C_RESET}"
  echo -e "${color}${C_BOLD}╚════════════════════════════════════════════════════════╝${C_RESET}"
}

ui_show_help() {
  cat << 'EOF'
Ralph - Autonomous Development Loop for Trinity v0.1

USAGE:
  ralph.sh [OPTIONS]

OPTIONS:
  --max-iterations <n>    Maximum iterations before auto-stop (default: 100)
  --base-branch <name>    Base branch to create story branches from (default: dev)
  --auto-pr               Auto-create PR without prompting (default: prompt)
  --auto-merge            Auto-merge PR without prompting (default: prompt)
  --resume                Resume from last state (skip story selection)
  --reset                 Reset state and start fresh
  -q, --quiet             Quiet mode - hide Claude output, show only Ralph status
  -h, --help              Show this help message

WORKFLOW:
  1. Pick next story (respecting dependencies)
  2. Create branch from dev
  3. Implement story with verification
  4. Self-review until done
  5. Commit and push
  6. Create PR to dev
  7. Merge PR (if --auto-merge or prompt)
  8. Move to next story

FILES:
  - prompt.md     : Agent instructions template
  - prd.json      : Task definitions with dependencies
  - progress.txt  : Progress tracking and learnings
  - state.json    : Persistent state between invocations

EXAMPLES:
  ./ralph.sh                          # Start fresh or continue
  ./ralph.sh --resume                 # Force resume current story
  ./ralph.sh --reset                  # Reset state, start fresh
  ./ralph.sh --max-iterations 5       # Limit iterations
EOF
}
