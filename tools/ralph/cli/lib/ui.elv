# UI helpers - colors and styled output for Ralph

# ANSI color codes
var C_RESET = "\e[0m"
var C_BOLD = "\e[1m"
var C_DIM = "\e[2m"
var C_CYAN = "\e[36m"
var C_GREEN = "\e[32m"
var C_YELLOW = "\e[33m"
var C_RED = "\e[31m"
var C_BLUE = "\e[34m"

# Styled output helpers
fn banner {|msg|
  echo $C_CYAN$C_BOLD"═══ RALPH ═══ "$msg$C_RESET
}

fn status {|msg|
  echo $C_BLUE"► "$C_RESET$msg
}

fn success {|msg|
  echo $C_GREEN$C_BOLD"✓ "$C_RESET$C_GREEN$msg$C_RESET
}

fn warn {|msg|
  echo $C_YELLOW"⚠ "$msg$C_RESET
}

fn error {|msg|
  echo $C_RED$C_BOLD"✗ "$msg$C_RESET
}

fn dim {|msg|
  echo $C_DIM$msg$C_RESET
}

fn divider {|label|
  echo $C_DIM"────────────────── "$label" ──────────────────"$C_RESET
}

fn divider-end {
  echo $C_DIM"───────────────────────────────────────────────────"$C_RESET
}

fn box {|title style|
  # style: success, warn, info
  var color = $C_CYAN
  if (eq $style "success") {
    set color = $C_GREEN
  } elif (eq $style "warn") {
    set color = $C_YELLOW
  }
  echo $color$C_BOLD"╔════════════════════════════════════════════════════════╗"$C_RESET
  echo $color$C_BOLD"║  "$title$C_RESET
  echo $color$C_BOLD"╚════════════════════════════════════════════════════════╝"$C_RESET
}

# Desktop notification (macOS/Linux)
fn notify {|title message|
  if (has-external osascript) {
    # macOS
    try {
      osascript -e 'display notification "'$message'" with title "'$title'"' 2>/dev/null
    } catch _ { }
  } elif (has-external notify-send) {
    # Linux
    try {
      notify-send $title $message 2>/dev/null
    } catch _ { }
  }
}

fn show-help {
  echo '
Ralph - Autonomous Development Loop for Trinity v0.1

USAGE:
  ralph.elv [OPTIONS]

OPTIONS:
  --max-iterations <n>    Maximum iterations before auto-stop (default: 100)
  --base-branch <name>    Base branch to create story branches from (default: dev)
  --auto-pr               Auto-create PR without prompting (default: prompt)
  --auto-merge            Auto-merge PR without prompting (default: prompt)
  --no-validate           Skip story validation before execution
  --yolo                  Full auto: --no-validate + --auto-pr + --auto-merge
  --notify                Send desktop notifications on story complete/blocked
  --skip ID "reason"      Skip a story, allowing dependents to proceed
  --retry-clean ID        Reset story for fresh retry (deletes branch, clears state)
  --timeout <seconds>     Claude timeout (default: 1800 = 30 min)
  --resume                Resume from last state (skip story selection)
  --reset                 Reset state and start fresh
  --status                Show PRD status (phases, epics, stories) and exit
  --stats                 Show metrics (tokens, durations, costs) and exit
  --version-status        Show version progress and exit
  --target-version <ver>  Only work on stories for specific version (e.g., v1.0)
  --plan                  Plan mode - output implementation plan without making changes
  -q, --quiet             Quiet mode - hide Claude output, show only Ralph status
  -v, --verbose           Verbose mode - show full prompts, responses, state transitions
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
  ./ralph.elv                          # Start fresh or continue
  ./ralph.elv --resume                 # Force resume current story
  ./ralph.elv --reset                  # Reset state, start fresh
  ./ralph.elv --max-iterations 5       # Limit iterations
'
}
