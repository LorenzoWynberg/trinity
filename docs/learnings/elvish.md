# Elvish Shell Learnings

> **TL;DR:** Values vs bytes (put vs echo), arity mismatches need list capture, always check has-key before map access, no path:glob.

## Value Pipeline vs Byte Pipeline

Elvish has TWO separate pipelines:
- **Value pipeline** - structured data via `put`
- **Byte pipeline** - raw text via `echo` (stdout)

```elvish
# echo writes bytes (stdout) - for display
echo "Hello"

# put writes values - for returning from functions
fn get-name { put "Alice" }
var name = (get-name)
```

External commands (jq, grep, git) only produce bytes. Use `slurp` to capture:
```elvish
var output = (git status | slurp)
```

## Arity Mismatches

Functions don't "return" - they "output" via `put`. Multiple `put` calls accumulate, causing arity errors:

```elvish
# WRONG - if function outputs multiple values, this fails
var result = (some-function)
# Error: "arity mismatch: arguments must be 1 value, but is N values"

# RIGHT - capture all outputs into list
var results = [(some-function)]
var result = $results[-1]  # get last element
```

When to use list capture:
- Calling any function that might output multiple values
- Capturing output from pipelines
- When you see arity mismatch errors

## Map Key Access

Always check `has-key` before accessing potentially missing keys:

```elvish
# WRONG - throws "no such key: foo"
var val = $some-map[foo]

# RIGHT - check first
var val = (if (has-key $some-map foo) { put $some-map[foo] } else { put "" })

# For boolean checks
if (and (has-key $state pr_url) $state[pr_url]) { ... }
```

## String Interpolation

```elvish
# Simple variable
echo "Hello "$name

# In strings - just use $var directly
var msg = "User: "$username

# NOT like bash - no {$var} or ${var}
```

## Common Gotchas

### No path:glob
```elvish
# WRONG
var files = (path:glob "*.json")

# RIGHT - use ls with grep
var files = [(ls | grep '\.json$')]
```

### Function naming conventions
Module functions use colon: `ui:warn`, `prd:get-next-story`

### Slurp can return multiple values
```elvish
# RISKY
var result = (some-command | slurp)

# SAFE
var result-list = [(some-command)]
var result = ""
if (> (count $result-list) 0) {
  set result = $result-list[0]
}
```

### Try/catch for error handling
```elvish
try {
  some-risky-operation
} catch e {
  echo "Error: "(to-string $e[reason])
}

# Ignore errors
try {
  might-fail
} catch _ { }
```

### Loops
```elvish
# For loop
for item $list {
  echo $item
}

# While loop
while $condition {
  # ...
}
```

### Conditionals
```elvish
if $condition {
  # ...
} elif $other {
  # ...
} else {
  # ...
}

# Ternary-style
var val = (if $cond { put "yes" } else { put "no" })
```

## Streaming (Important for Claude output)

Streaming requires running at TOP LEVEL, not inside functions:

```elvish
# This works (top level)
timeout 30 claude --output-format stream-json < prompt.md | \
  grep --line-buffered '^{' | \
  jq --unbuffered -rj '.text'

# This may NOT stream properly (inside function)
fn run-claude {
  # streaming broken here
}
```

Key flags for streaming:
- `--line-buffered` on grep
- `--unbuffered` on jq
- `-rj` on jq (raw output, join)
