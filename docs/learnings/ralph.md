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

## Gotchas

### Elvish quirks
- **No `path:glob`** - use `ls | grep` pattern instead
- **Arity mismatches** - functions returning multiple values need `| take 1` if you only want first
- **Function naming** - it's `ui:warn` not `ui:warning`
- **Variables in strings** - use `$var` not `{$var}` for interpolation
