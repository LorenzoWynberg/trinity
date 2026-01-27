# Prompt System

Ralph uses a task-oriented prompt system that leverages Claude Code's native task tracking.

## Architecture

```
prompt.md (main prompt)
    ↓
Claude creates 5 tasks
    ↓
Each task references instruction file
    ↓
Instructions loaded on-demand per phase
```

## Phases

| Phase | Task | Instructions |
|-------|------|--------------|
| 1. Understand | Read story, docs, gotchas | `instructions/context.md` |
| 2. Plan | Outline approach | Task description |
| 3. Implement | Write code | `instructions/implementation.md` |
| 4. Verify | Build, test, review | Commands in task |
| 5. Complete | Log, commit, signal | `instructions/completion.md` |

## Files

```
tools/ralph/cli/
├── prompt.md                    # Main prompt (task-oriented)
├── prompts/
│   └── feedback.md              # Feedback loop prompt
└── instructions/
    ├── context.md               # What docs to read
    ├── implementation.md        # Coding guidelines
    ├── activity-log.md          # Log template with YAML frontmatter
    └── completion.md            # Success/blocked handling
```

## How It Works

1. **Ralph** prepares `prompt.md` with placeholders filled (story ID, branch, etc.)
2. **Claude** receives lean prompt, creates 5 tasks upfront
3. **Per task**, Claude reads relevant instruction file
4. **Progress** visible in Claude Code UI via task list
5. **On complete**, Claude writes `signal.json` for Ralph to detect

## Benefits

- **Lean prompts** - Less token usage per invocation
- **On-demand loading** - Instructions read only when needed
- **Visible progress** - Task UI shows current phase
- **Clear completion** - Each phase has explicit "done when" criteria

## Placeholders

| Placeholder | Source |
|-------------|--------|
| `{{CURRENT_STORY}}` | Story ID from PRD |
| `{{VERSION}}` | PRD version (v0.1, v1.0, etc.) |
| `{{BRANCH}}` | Git branch name |
| `{{ATTEMPT}}` | Attempt number (1, 2, ...) |
| `{{FEEDBACK}}` | User feedback (if any) |
| `{{RECENT_ACTIVITY_LOGS}}` | Last 2 activity logs |

## Feedback Flow

When user provides feedback, Ralph uses `prompts/feedback.md` instead:
1. Shows original task + feedback
2. Claude creates 4 tasks (understand, change, verify, signal)
3. Focus stays on feedback - no unrelated changes
