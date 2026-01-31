# Recovery & Resume

Ralph is designed for long-running autonomous sessions. Crashes, timeouts, and interruptions are expected. This chapter covers how to recover gracefully.

## Checkpoints

Ralph saves progress at each major phase so `--resume` can skip completed work.

### Checkpoint Stages

| Stage | When Saved | What It Means |
|-------|------------|---------------|
| `branch_created` | After story selection | Branch exists, ready for validation |
| `validation_complete` | After validation passes | Story is valid, ready for Claude |
| `claude_started` | Before Claude invocation | Claude is running (cannot resume mid-execution) |
| `claude_complete` | After completion signal | Claude finished, ready for PR |
| `pr_created` | After PR created | PR exists, waiting for merge |

### Checkpoint Data

Each checkpoint stores contextual data:

```json
{
  "story_id": "1.2.3",
  "stage": "claude_complete",
  "at": "2026-01-27T15:30:00Z",
  "attempt": 2,
  "data": {
    "signal": "complete",
    "commit": "abc123"
  }
}
```

Stage-specific data:
- `branch_created`: branch name, commit hash
- `validation_complete`: clarification text (if provided)
- `claude_started`: attempt number
- `claude_complete`: signal type, commit hash
- `pr_created`: PR URL

## Resume Modes

### Basic Resume

```bash
./ralph.elv --resume
```

Detects most advanced checkpoint and skips to that phase:
- `pr_created` or `claude_complete` → PR flow
- `validation_complete` → Claude execution
- `branch_created` → Validation

**Note:** `claude_started` doesn't allow mid-execution resume. Ralph restarts Claude from the beginning of that phase.

### Fresh Start

```bash
./ralph.elv --reset
```

Clears state but preserves checkpoints. Use when you want to pick a new story.

### Retry Clean

```bash
./ralph.elv --retry-clean STORY-1.2.3
```

Nuclear option - clears everything for a story:
- Deletes local branch
- Deletes remote branch
- Resets story in PRD (passes=false, merged=false)
- Clears all checkpoints
- Clears state.json

Use when a story is hopelessly stuck.

## Smart Retry

When retries fail repeatedly, Ralph tracks the failure and provides context to Claude.

### How It Works

1. **Failure tracking:** Each failure records an error message
2. **Same error detection:** If the next failure has the same error, increment counter
3. **Context injection:** On retry, Claude receives "Previous attempt failed because: X"
4. **Auto-escalation:** After 2+ failures with same error, prompt for user feedback

### Failure Messages

| Scenario | Error Message |
|----------|--------------|
| Timeout | "Timeout after Xs - story may be too complex" |
| Claude error | "Claude error: <reason>" |
| Blocked signal | "Story blocked - Claude reported blocked status" |

### Auto-Escalation Prompt

After 2+ consecutive failures with the same error:

```
This story has failed 2 times with the same error:
  Timeout after 1800s - story may be too complex

[f]eedback - Provide guidance to help Claude succeed
[r]etry    - Try again with failure context
[s]kip     - Skip this story for now
```

The `[f]eedback` option opens an editor pre-filled with the error context.

### Prompt Injection

When retrying with failure context, Claude receives:

```markdown
## Previous Attempt Failed

**IMPORTANT:** The previous attempt to complete this story failed.

> Timeout after 1800s - story may be too complex

**Instructions:**
1. Analyze what went wrong in the previous attempt
2. Take a different approach to avoid the same issue
3. Consider simpler alternatives if the original approach was too complex
```

### Clearing Failure Tracking

Failure tracking is cleared when:
- Story completes successfully
- `--retry-clean` is run
- User provides feedback (resets counter)

## Common Scenarios

### Claude Timeout

```
Claude timed out after 1800s
The story might be too complex. Try:
  • Breaking it into smaller stories
  • Increasing timeout with --timeout <seconds>
  • Running ./ralph.elv --resume to continue
```

**What happened:** Claude hit the 30-minute default timeout.

**Recovery:**
1. `./ralph.elv --resume` - Restarts Claude (validation checkpoint exists)
2. Or `./ralph.elv --timeout 3600 --resume` - Resume with longer timeout

### Ctrl+C Interrupt

**What happened:** You pressed Ctrl+C during execution.

**Recovery:**
1. `./ralph.elv --resume` - Continues from last checkpoint
2. If interrupted during Claude: restarts Claude execution
3. If interrupted during PR flow: skips to PR flow

### Process Crash

**What happened:** Terminal closed, machine rebooted, etc.

**Recovery:**
1. Check `./ralph.elv --status` to see current state
2. `./ralph.elv --resume` to continue

### Story Won't Complete

**Symptoms:** Story keeps failing, Claude can't figure it out.

**Options:**
1. `./ralph.elv --retry-clean STORY-1.2.3` - Fresh start
2. `./ralph.elv --skip STORY-1.2.3 "reason"` - Skip and move on
3. `./ralph.elv --refine-prd STORY-1.2.3` - Have Claude improve the story definition

## Checkpoint Cleanup

Checkpoints are automatically cleared when:
- Story is successfully merged
- Story is blocked (Claude writes `"status": "blocked"` to signal.json)
- `--retry-clean` is run

If checkpoints accumulate (bug), manually edit `state.json`:
```json
{
  "checkpoints": []
}
```

## Debugging

### Check Current State

```bash
./ralph.elv --status
```

Shows:
- Current story (if any)
- Branch name
- Status (idle, in_progress, blocked)
- Attempt count

### Verbose Mode

```bash
./ralph.elv --resume -v
```

Shows:
- Full prompts sent to Claude
- State transitions
- Checkpoint saves/loads
