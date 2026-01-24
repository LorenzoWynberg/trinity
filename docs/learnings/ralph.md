# Ralph Learnings

> **TL;DR:** Two-stage completion (passes→merged), activity logs via `{{RECENT_ACTIVITY_LOGS}}`, PR defaults (yes create, no merge), Claude-generated PR descriptions from git history.

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
`docs/activity/YYYY-MM-DD.md` with timestamped entries documenting what was done.

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
