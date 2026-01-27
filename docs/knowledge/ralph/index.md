# Ralph Overview

Ralph is your tireless coding companion. Point it at a PRD, grab a coffee (or go to sleep), and let it work through stories one by one - implementing, testing, creating PRs, and merging - all while you're away.

## Quick Start

```bash
# See what's in the queue
./ralph.elv --status

# Start working (Ralph asks before each PR)
./ralph.elv

# Full autopilot - go grab dinner
./ralph.elv --yolo
```

That's it. Ralph picks the next story, implements it, and handles the git flow. You can stop anytime with `Ctrl+C` and resume later with `--resume`.

## How It Works

1. **Query PRD** - Find next story with dependencies met
2. **Create branch** - Auto-managed feature branch
3. **Run Claude** - Implement the story
4. **Self-review** - Iterate until passing
5. **PR Flow** - Create PR, optionally merge
6. **Repeat** - Until all stories complete

## Two-Stage Completion

PRD state tracks two flags per story:
- `passes: true` - Claude completed the work
- `merged: true` - PR merged to base branch

**Why this matters:** Dependencies check `merged`, not `passes`. Prevents starting work before code is in dev.
