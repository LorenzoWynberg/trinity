# Ralph Learnings

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
