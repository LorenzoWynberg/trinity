# Ralph Learnings

> **TL;DR:** Two-stage completion (passes→merged), activity logs split by project (trinity/ for Ralph's work, ralph/ for human docs), release workflow with human gate and hotfix loop, PR defaults (yes create, no merge).

## Streaming Claude Output

### jq filters for stream-json
From [aihero.dev](https://www.aihero.dev/heres-how-to-stream-claude-code-with-afk-ralph):

```bash
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
final_result='select(.type == "result").result // empty'

claude --output-format stream-json < prompt.md 2>&1 | \
  grep --line-buffered '^{' | \
  tee output.json | \
  jq --unbuffered -rj "$stream_text"
```

Key flags:
- `--line-buffered` on grep for real-time output
- `--unbuffered` on jq for streaming
- `-rj` on jq: raw output, join without newlines

## State Management

### Passes vs Merged
Two-stage completion tracking:
- `passes: true` - Claude completed the work and pushed
- `merged: true` - PR actually merged to base branch

**Why this matters:**
- Dependencies check `merged`, not `passes`
- Prevents next story from starting before code is in dev
- Allows handling "completed but not merged" scenarios

## PR Flow

### Prompts with defaults
- PR creation: `[Y]es / [n]o` - defaults to yes
- Merge: `[y]es / [N]o` - defaults to no (leave for review)
- Stop loop: `[y/N]` with 120s timeout - defaults to continue

## Activity Logging

### Daily log format
`logs/activity/YYYY-MM-DD.md` with timestamped entries documenting what was done.

### Including in prompts
Read 2 most recent logs and include via `{{RECENT_ACTIVITY_LOGS}}` placeholder. Gives Claude context about recent work.

## Feedback Loop

### PR-level feedback
At merge prompt, user can choose:
- `[y]es` - merge the PR
- `[N]o` - leave open for review (default)
- `[f]eedback` - provide feedback and re-run Claude

When feedback is given:
1. User enters feedback text (press Enter twice to finish)
2. Ralph passes feedback to Claude via `{{FEEDBACK}}` placeholder
3. Claude runs full cycle: implement changes, build, test, format, self-review
4. If complete, returns to PR flow (can give more feedback or merge)

### Feedback in prompt template
```markdown
{{FEEDBACK}}
```
Expands to a section with the user's feedback and instructions when provided.

## PR Description Generation

### Claude-generated PR bodies
Uses `gh pr create` and `gh pr edit` with Claude-generated descriptions.

### All changes included
PR body includes ALL commits and files from base branch to feature branch:
- `git log --oneline base..branch` - all commits
- `git diff --name-status base..branch` - all changed files
- `git diff --stat base..branch` - change statistics

### Merging existing descriptions
When updating a PR, existing body is fetched and passed to Claude with instruction to merge/extend content rather than replace.

## Activity Log Organization

### Separate by project
```
logs/activity/
├── trinity/        # Ralph writes here (Trinity CLI development)
│   ├── YYYY-MM-DD.md
│   └── archive/YYYY-MM/
└── ralph/          # Humans write here (Ralph's own development)
    └── YYYY-MM-DD.md
```

**Key distinction:** Ralph works ON Trinity, so Ralph writes to `trinity/` logs. The `ralph/` folder is for human documentation about Ralph itself.

### Archive structure
Old logs go to `archive/YYYY-MM/filename.md` subdirectories, not flat in archive folder.

## Release Workflow

### Human gate at completion
When all stories complete, prompt for release approval:
- `[Y]es` - proceed with release
- `[n]o` - cancel
- `[e]dit tag` - change version tag
- `[f]eedback` - run hotfix, then return to prompt

### Tag on main, not dev
Release flow: create PR (dev→main) → merge → checkout main → tag at merge commit → push tag. The tag must be on main, not on dev.

### Hotfix flow
Feedback at release creates a hotfix branch from dev, runs Claude with the feedback, merges back to dev, then returns to release prompt.

## Elvish Gotchas

### General quirks
- **No `path:glob`** - use `ls | grep` pattern instead
- **Function naming** - it's `ui:warn` not `ui:warning`
- **Variables in strings** - use `$var` not `{$var}` for interpolation

### Arity mismatches

Elvish functions don't "return" values - they "output" values via `put`. Multiple `put` calls accumulate. When calling a function that might output multiple values, capture into a list:

```elvish
# WRONG - causes "arity mismatch: arguments must be 1 value, but is N values"
if (not (some-function $arg)) {

# RIGHT - capture all outputs, use the one you want
var results = [(some-function $arg)]
if (and (> (count $results) 0) (not $results[-1])) {
```

Key concepts:
- `echo` writes to byte pipe (stdout) - doesn't affect value output
- `put` writes to value pipe - accumulates as function outputs
- `[(command)]` captures all value outputs into a list
- `$list[-1]` gets last element (typically the intended result)
- External commands (jq, sed, grep) only produce bytes, not values

### Map key access

Always check `has-key` before accessing a map key that might not exist:

```elvish
# WRONG - throws "no such key: foo" if key missing
var val = $some-map[foo]

# RIGHT - check first
var val = (if (has-key $some-map foo) { put $some-map[foo] } else { put "" })

# For boolean checks, combine with and:
if (and (has-key $state pr_url) $state[pr_url]) { ... }
```
