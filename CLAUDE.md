# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trinity is a CLI tool for running autonomous AI development loops. It points at a project, reads stories from a PRD, and uses Claude Code to implement them autonomously while the developer is AFK.

**Status:** Planning phase - no code implementation yet. See `docs/plans/INITIAL_PLAN.md` for full architecture.

## Architecture

Go monorepo with workspaces:

```
trinity/
├── go.work              # Go workspace
├── core/                # Shared logic (config, loop, claude, prd)
├── cli/                 # CLI app (cmd/trinity/main.go)
├── gui/                 # Wails desktop app (v0.2)
├── prompts/             # Meta-prompts (embedded via go:embed)
└── examples/            # Reference implementations
```

**Key principle:** `core/` contains all shared logic imported by both CLI and GUI. Each component has its own `go.mod`.

## Build Commands (when implemented)

```bash
# Go workspace
go work sync             # Sync workspace modules

# CLI
cd cli && go build ./cmd/trinity

# Run tests
go test ./...
```

## Core Concepts

### Autonomous Dev Loop
1. Read PRD with stories from `.trinity/prd.json`
2. Pick next story based on dependencies
3. Create feature branch
4. Run Claude Code to implement
5. Self-review and iterate
6. Create PR, merge, cleanup
7. Repeat until all stories complete

### Story Format (prd.json)
```json
{
  "id": "STORY-1.2.3",
  "title": "Story title",
  "intent": "Why this matters",
  "acceptance": ["Criterion 1", "Criterion 2"],
  "passes": false,
  "depends_on": ["STORY-1.1.1"]
}
```

### Claude Code Integration
Trinity shells out to `claude` CLI - it's the execution engine, not just an API. Claude Code handles file I/O, bash commands, and context management.

## Reference Implementation

See `examples/jetbrains-elvish/` for a working autonomous loop in Elvish that Trinity will port to Go:
- `ralph.elv` - Full loop implementation
- `prd.json` - 60+ stories with dependencies
- `prompt.md` - Story execution template
