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
- PR creation: `[Y]es / [n]o / [f]eedback` - defaults to yes
- PR update (after feedback): `[Y]es / [n]o / [f]eedback` - defaults to yes
- Merge: `[y]es merge / [N]o leave open / [f]eedback` - defaults to no (leave for review)
- Stop loop: `[y/N]` with 120s timeout - defaults to continue

All prompts support `[f]eedback` which restarts the Claude loop with user feedback.

## Activity Logging

### Daily log format
`logs/activity/YYYY-MM-DD.md` with timestamped entries documenting what was done.

### Including in prompts
Read 2 most recent logs and include via `{{RECENT_ACTIVITY_LOGS}}` placeholder. Gives Claude context about recent work.

## Feedback Loop

### Three checkpoints with feedback
All three checkpoints support `[f]eedback` option that restarts the loop:

1. **Create PR prompt**: `[Y]es / [n]o / [f]eedback`
   - Before PR is created, user can give feedback to refine the work

2. **Update PR prompt**: `[Y]es / [n]o / [f]eedback`
   - After coming back from feedback loop, asks if PR should be updated
   - If `--auto-pr` flag, auto-updates without prompting

3. **Merge prompt**: `[y]es merge / [N]o leave open / [f]eedback`
   - At merge time, user can request more changes

### Feedback restarts the loop
When feedback is given at any checkpoint:
1. User enters feedback text via editor ($EDITOR or vim)
2. Feedback becomes the prompt for Claude (uses dedicated feedback template)
3. Claude runs full cycle: implement changes, build, test, format, self-review
4. Returns to the checkpoint where feedback was given
5. Can give more feedback or proceed

### Prompt templates
- `prompt.md` - Main story execution template
- `prompts/feedback.md` - Feedback template (includes original task context)
- `prompts/partials/workflow.md` - Shared workflow instructions (verification, self-review, learnings, etc.)

### Feedback template structure
```markdown
# Feedback on {{CURRENT_STORY}}

## Original Task
{{ORIGINAL_TASK}}  # Story title + acceptance criteria

## Feedback
> {{FEEDBACK}}    # User's feedback text

{{WORKFLOW}}      # Shared workflow instructions
```

This gives Claude:
1. Context about what the task was
2. What was requested to change
3. Same workflow instructions as normal execution

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

### Avoid slurp for capturing command output

`slurp` can return multiple values in edge cases, causing arity mismatches. Use the list capture pattern instead:

```elvish
# RISKY - slurp can return multiple values
var result = (some-command | slurp)

# SAFE - capture to list, take first element
var result-raw = [(some-command)]
var result = ""
if (> (count $result-raw) 0) {
  set result = $result-raw[0]
}
```
