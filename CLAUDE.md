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

## Storage

Everything lives in `~/.trinity/` - user projects stay clean:

```
~/.trinity/
├── auth.json                         # OAuth tokens, subscription
├── config.json                       # Global preferences
├── projects/
│   └── <project-hash>/
│       ├── prd/
│       │   ├── index.json            # Phases, epics, deps, agents
│       │   └── phases/
│       │       ├── mvp/
│       │       │   └── epics/
│       │       │       └── auth/
│       │       │           └── stories/
│       │       └── growth/
│       │           └── epics/
│       │               └── payments/
│       └── workspaces/
│           ├── trunk/                # Default workspace (actual repo)
│           └── feature-<name>/       # Isolated clone
│               └── repo/
```

User's project gets no scaffolded files. The output is commits/code.

## PRD Structure

**Hierarchy:** Phase → Epic → Story

- **Phase**: Major milestone ("MVP", "Growth")
- **Epic**: Complete feature ("Auth", "Payments")
- **Story**: Single implementable task ("Add login form")

**Universal dependency syntax** (3-level hierarchy):
```
"mvp"                        → whole phase
"mvp:auth"                   → epic in phase
"mvp:auth:STORY-1.1.2"       → specific story
```

A phase can depend on just a story. An epic can depend on just a story. Maximum flexibility, minimum blocking.

`index.json` tracks: phases, epics, dependencies, agent assignments (for crash recovery).

## Parallel Features

```bash
trinity feature list --available      # Shows what can start (deps met)
trinity feature suggest               # Parallelization opportunities
trinity feature create "auth"
trinity feature create "notifications"  # No deps - can run parallel
trinity run --all                     # Both run simultaneously
trinity run mvp:auth:STORY-1.1.2      # Run specific story to unblock deps
trinity recover                       # Restart crashed agents
```

Defaults: `--auto-pr=true`, `--auto-merge=false` (user reviews PRs).

## Branching Strategy

```
main (stable)
  ↑
dev (integration) ← features merge here
  ↑
feature branches
```

- Features auto-merge to `dev` when complete
- Dependencies resolve when code is in `dev`
- New features clone from `dev` (get all merged code)
- `trinity release` merges `dev` → `main`

## Core Concepts

### Autonomous Dev Loop
1. Read PRD with stories from `~/.trinity/projects/<hash>/prd.json`
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

### Orchestration

Trinity isn't just a loop runner - it's an orchestrator with built-in "skills":

```bash
trinity chat                    # Interactive - discuss, plan, orchestrate
trinity analyze                 # Deep dive on codebase
trinity plan "add auth"         # Generate implementation plan
trinity prd generate            # Turn plan into structured stories
trinity prd refine              # AI review and improve stories
trinity run                     # Execute the implementation loop
```

Users talk to Trinity, Trinity executes workflows via Claude Code with the right meta-prompts.

### Claude Code Integration
Trinity shells out to `claude` CLI - it's the execution engine, not just an API. Claude Code handles file I/O, bash commands, and context management.

### Meta-Prompts
Embedded prompts in `prompts/` that Trinity uses for orchestration:
- `plan.md` - Break feature into implementation approach
- `prd-generate.md` - Turn plan into stories
- `prd-refine.md` - Improve story quality
- `story-execute.md` - Implementation loop
- `chat.md` - Interactive orchestration

## Reference Implementation

See `examples/jetbrains-elvish/` for patterns Trinity will port to Go:
- `ralph.elv` - Full loop implementation
- `prd.json` - 60+ stories with dependencies
- `prompt.md` - Story execution template
