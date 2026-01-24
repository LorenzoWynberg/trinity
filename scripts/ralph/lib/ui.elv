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
