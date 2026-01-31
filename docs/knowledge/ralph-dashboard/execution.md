# Execution Loop

The dashboard can run the full autonomous development loop through a wizard modal interface.

## Run Page (`/run`)

The Run page shows:
- **Start Run button** - Opens the wizard modal
- **Progress card** - Stories merged/total, current story, last completed
- **Story Queue** - Ranked list with scoring breakdown
- **Next Up** - Preview of the next story

## Wizard Modal

Click "Run Story" to open a multi-step wizard:

### Step 1: Config

```
┌─────────────────────────────────────────────────────────┐
│  Run Story                                    Step 1/5  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Version: [v0.1 ▼]                                      │
│  Story:   [Next best ▼]                                 │
│                                                         │
│  Mode:    [Manual ▼]                                    │
│                                                         │
│  ☐ Auto-clarify                                        │
│  ☐ Auto-PR                                             │
│  ☐ Auto-merge                                          │
│                                                         │
│                                        [Start Run →]    │
└─────────────────────────────────────────────────────────┘
```

**Mode options:**
- **Manual** (default) - Stop at each gate, user controls options
- **Autopilot** - All options enabled, runs continuously

When Autopilot is selected, all checkboxes are checked and disabled with an explanation message.

**Autopilot behavior:**
- Automatically continues to the next story after each completion
- Skips validation gates (makes reasonable assumptions)
- Creates PRs and merges automatically
- "Stop after this story" button available during Execute step for graceful stopping

### Step 2: External Deps (if needed)

Only shown if story has `external_deps` array. Quick check - skip early if deps not ready.

- **Skip Story** - Move to next story
- **Continue** - Submit report describing how deps were implemented

### Step 3: Validation (if needed)

Only shown if story has vague terms or unclear acceptance criteria.

- **Skip** - Move to next story
- **Auto** - Let Claude make reasonable assumptions
- **Continue** - Submit clarification

### Step 4: Execute

Shows Claude working with a spinner. Displays execution logs as they come in.

**Agent Pipeline**: During execution, the multi-agent system coordinates work:
```
Analyst → Implementer ⇄ Reviewer → Refactorer → Documenter
```
The modal shows current agent and progress through the pipeline. See [Handoffs](handoffs.md) for details.

In Autopilot mode, a "Stop after this story" button appears. Clicking it will:
- Show confirmation that the run will stop after current story
- Allow cancellation if you change your mind
- Stop the autopilot loop when the current story completes

### Step 5: Review

Shows PR link and feedback textarea.

- **Request Changes** - Re-runs Claude with feedback, returns to Execute step
- **Merge PR** - Merges and continues to Done

### Step 6: Done

Shows success message with option to:
- **Close** - Exit modal
- **Run Next Story** - Reset and start again

In Autopilot mode:
- If "Stop after this story" was clicked, shows "Autopilot stopped as requested"
- Otherwise, automatically continues to the next story after a 1-second delay

## Execution Flow

```
1. Config        → Select version, story, mode
2. Ext Deps      → If story has external_deps (cheap check, skip early)
3. Validation    → If story has issues (only if proceeding)
4. Execute       → Claude runs, creates commits
5. Review        → PR created, merge or feedback loop
6. Done          → Next story or finish
```

## Configuration Options

| Option | Description |
|--------|-------------|
| Version | PRD version to work on |
| Story | Next best (smart selection) or specific story |
| Mode | Manual or Autopilot |
| Auto-clarify | Skip validation gate, make assumptions |
| Auto-PR | Create PR automatically after execution |
| Auto-merge | Merge PR without review step |

## Feedback Loop

At the Review step, entering feedback and clicking "Request Changes":
1. Feedback injected into Claude's next prompt
2. Claude re-runs with context about previous issues
3. New commits pushed to same PR
4. PR description updated with iteration notes
5. Returns to Review step
6. Repeat until approved

## PR Message Updates

On iteration, PR description is updated:

```markdown
## [STORY-1.2.3] Add Stripe checkout

Original description...

---
### Iteration 2
Feedback: "Use ErrorBoundary instead of try/catch"
Changes: Refactored error handling
```

## API

### GET `/api/run?version=v0.1`

Returns execution status for the Run page display.

### POST `/api/run`

Controls execution:
```json
{
  "action": "start" | "continue" | "stop" | "reset",
  "version": "v0.1",
  "config": {
    "singleStoryId": null,
    "autoMode": false,
    "autoClarify": false,
    "autoPR": false,
    "autoMerge": false
  },
  "gateResponse": { "type": "validation", "response": { "action": "clarify", "clarification": "..." } }
}
```

### POST `/api/signal`

Claude calls this to signal story completion:
```json
{
  "storyId": "v0.1:1.1.1",
  "action": "complete" | "blocked" | "progress",
  "message": "Optional status message",
  "prUrl": "Optional PR URL"
}
```

This replaces the old XML signal parsing from Claude output. Claude uses curl to call this endpoint as its final action when completing a story.

## Signal Flow

```
1. Dashboard starts Claude with story prompt
2. Claude implements story, commits, pushes
3. Claude calls POST /api/signal with action=complete
4. Dashboard polls for up to 30s waiting for story.passes=true
5. Dashboard proceeds to PR/merge flow
```

If Claude gets blocked:
```
1. Claude encounters blocker (missing dep, unclear requirement)
2. Claude calls POST /api/signal with action=blocked
3. Dashboard detects run_state.status=blocked via polling
4. Dashboard shows blocked UI with error message
```

If Claude exits without signaling:
```
1. Dashboard polls for 30s, no signal received
2. Dashboard shows error: "Claude exited without signaling completion"
3. User can manually check if work was done
```

## Configuration

The dashboard URL is configurable via the `dashboardUrl` setting (default: `http://localhost:3000`). This URL is injected into the prompt so Claude knows where to send signals.
