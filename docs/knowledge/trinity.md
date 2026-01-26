# Trinity Knowledge Base

> **TL;DR:** Trinity is a CLI tool for running autonomous AI development loops. It reads stories from a PRD and uses Claude Code to implement them while the developer is AFK.

## Overview

Trinity points at a project, reads stories from a structured PRD, and orchestrates Claude Code to implement them autonomously. The developer reviews PRs and merges when ready.

## Architecture

```
trinity/
├── core/           # Shared logic (config, loop, claude, prd, db)
├── cli/            # CLI app (cmd/trinity/main.go)
├── gui/            # Wails desktop app (future)
├── prompts/        # Meta-prompts (embedded via go:embed)
└── tools/ralph/    # Current prototype in Elvish
```

## Storage

Everything lives in `~/.trinity/` - user projects stay clean:

```
~/.trinity/
├── config.json                       # Global preferences
├── projects/
│   └── <project-hash>/
│       ├── config.json               # Project config
│       ├── trinity.db                # All state (SQLite)
│       └── worktrees/                # Git worktrees for parallel work
```

## Core Concepts

### Story Format
```json
{
  "id": "STORY-1.2.3",
  "title": "Story title",
  "intent": "Why this matters",
  "description": "Implementation context",
  "acceptance": ["Criterion 1", "Criterion 2"],
  "depends_on": ["STORY-1.1.1"],
  "passes": false,
  "merged": false
}
```

### Two-Stage Completion
- `passes: true` - Claude completed the work
- `merged: true` - PR merged to integration branch

Dependencies check `merged`, not `passes`.

### Branching Strategy
```
main (stable)
  ↑
dev (integration) ← features merge here
  ↑
feature branches (auto-managed)
```

---
<!-- updatedAt: 2026-01-26 -->
<!-- lastCompactedAt: 2026-01-26 -->
