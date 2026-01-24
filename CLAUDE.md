# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trinity is a CLI tool for running autonomous AI development loops. It points at a project, reads stories from a PRD, and uses Claude Code to implement them autonomously while the developer is AFK.

**Status:** Planning phase - ready for implementation. See `docs/` for full documentation.

## Architecture

Go monorepo with workspaces:

```
trinity/
├── go.work              # Go workspace
├── core/                # Shared logic (config, loop, claude, prd, db)
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
│       ├── config.json               # Project config
│       ├── trinity.db                # All state: PRD, agents, activity, learnings
│       └── workspaces/
│           ├── trunk/                # Default workspace (actual repo)
│           └── feature-<name>/       # Isolated clone (auto-managed)
│               └── repo/
```

User's project gets no scaffolded files. The output is commits/code.

## Database Layer

All state lives in SQLite (`trinity.db`). Trinity provides a clean API layer:

**Schema:**
```sql
-- PRD Structure
phases (id, name, status, depends_on, priority)
epics (id, phase_id, name, path, status, depends_on, priority)
stories (id, epic_id, title, intent, acceptance, status, depends_on, priority,
         human_testing_required, human_testing_instructions, human_testing_url)

-- Tags (shared, many-to-many)
tags (id, name)
phase_tags, epic_tags, story_tags, learning_tags

-- Agents
agents (id, workspace, epic, current_story, pid, status, started_at)

-- Activity
activity_logs (id, timestamp, agent, action, message, story_ref)

-- Knowledge
learnings (id, content, created_at, updated_at)
learning_tags (learning_id, tag_id)
```

**DB API (`core/db`):**
```go
// PRD operations
db.Phases.List(opts)                    // Filter by status, tags
db.Phases.Get(id)
db.Epics.List(phaseID, opts)
db.Epics.GetByPath("mvp:auth")
db.Stories.List(epicID, opts)
db.Stories.GetNext()                    // Next runnable (deps met)
db.Stories.Insert(story)
db.Stories.Update(id, changes)
db.Stories.Move(from, to)               // Renumber, update refs

// Dependency resolution
db.Dependencies.Check(ref)              // Returns unmet deps
db.Dependencies.Resolve(ref)            // Mark as satisfied

// Tag queries
db.Tags.Find("auth")
db.Stories.ByTag("auth", "frontend")    // AND query
db.Learnings.ByTag("gotcha")

// Activity
db.Activity.Log(agent, action, message)
db.Activity.Recent(limit)
db.Activity.ForStory(storyID)

// Learnings
db.Learnings.Search(keywords)           // Full-text search
db.Learnings.Insert(content, tags)
db.Learnings.Related(storyID)           // By shared tags

// Agents
db.Agents.Register(workspace, epic)
db.Agents.Heartbeat(id)
db.Agents.Stale(timeout)                // Find crashed agents
db.Agents.Release(id)
```

**Internal commands (Claude calls these):**
```bash
trinity internal complete <story>           # Mark story done
trinity internal add-story <epic> "title"   # Add story
trinity internal log "message"              # Write to activity
trinity internal learn "content" --tags x,y # Add learning
trinity internal move-story <from> <to>     # Renumber, update refs
```

Claude never writes to DB directly - calls internal commands. Trinity queues and processes sequentially (no conflicts).

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

## CLI Commands

Trinity has a minimal, focused command set. See `docs/COMMANDS.md` for full reference with all flags.

```bash
trinity auth login|logout|status     # Authentication
trinity init [--force]               # Initialize project
trinity analyze [--json|--brief]     # Analyze codebase

# PRD Management
trinity plan add                     # Create plan or add to existing
trinity plan show [ref] [--next|--blocked|--json]  # View plan
trinity plan refine [ref]            # AI improve stories
trinity plan skip|retry <ref>        # Change status

# Execution
trinity run [ref]                    # Run dev loop
trinity run --all                    # Parallel execution
trinity run --with-deps              # Run deps first
trinity run --once                   # Single story only
trinity run --docker                 # Isolated container
trinity run --attach|--stop|--kill   # Control running loop

# Human Testing
trinity approve [ref]                # Approve test
trinity reject [ref] "feedback"      # Reject with feedback

# Status & Config
trinity status [--watch|--json]      # Overview
trinity config show|set|edit         # Configuration

# Ship
trinity hotfix "desc" [--target|--auto-merge|--link]  # Quick fixes
trinity release [--dry-run|--tag]    # Merge dev → main

# Internal (Claude's API)
trinity internal complete|add-story|log|learn|move-story
```

**Flow:** `analyze → plan add → run`

**Auto workspace management:** `trinity run` automatically creates/manages workspaces. No manual feature commands needed.

## Docker Isolation (Optional)

For users who want extra safety, Trinity can run Claude Code in isolated Docker containers:

```bash
trinity run --docker            # Run in isolated container
trinity run --all --docker      # All work in containers
```

**What it provides:**
- Filesystem isolation - AI can only access mounted project directory
- Resource limits - CPU/memory caps prevent runaway processes
- Network restrictions - can limit or disable network access

**Data safety:** Project and `~/.trinity/` are mounted volumes, so all state persists. Only uncommitted WIP is at risk if container crashes (same as local).

## Branching Strategy

```
main (stable)
  ↑
dev (integration) ← features merge here
  ↑
feature branches (auto-managed)
```

- Features auto-merge to `dev` when complete
- Dependencies resolve when code is in `dev`
- New features branch from `dev` (get all merged code)
- `trinity release` merges `dev` → `main`

## Core Concepts

### Autonomous Dev Loop
1. Query DB for next story (deps met, not blocked)
2. Create feature branch (auto-managed workspace)
3. Run Claude Code to implement
4. Self-review and iterate
5. **If `human_testing.required`**: pause for manual verification
6. Create PR, merge to dev
7. Repeat until all stories complete

### Story Format
```json
{
  "id": "STORY-1.2.3",
  "title": "Story title",
  "intent": "Why this matters",
  "acceptance": ["Criterion 1", "Criterion 2"],
  "passes": false,
  "depends_on": ["mvp:auth:STORY-1.1.1"],
  "human_testing": {
    "required": true,
    "instructions": "Test login with valid/invalid credentials",
    "url": "/login"
  }
}
```

### Claude Code Integration
Trinity shells out to `claude` CLI - it's the execution engine, not just an API. Claude Code handles file I/O, bash commands, and context management.

### Prompt Templates & Schemas

```
prompts/
├── templates/           # Prompts with {{placeholders}}
│   ├── plan-add-init.md     # plan add when no plan exists
│   ├── plan-add-extend.md   # plan add when plan exists
│   ├── story-execute.md
│   └── analyze.md
├── schemas/             # Expected JSON response formats
│   ├── prd-add.json
│   └── ...
└── internal/            # Internal command prompts
    ├── learn.md
    ├── complete.md
    └── ...
```

**Flow:** CLI fills template → sends to Claude → Claude returns JSON → CLI parses and renders UI.

**Token optimization:** Minimal context in, structured JSON out. No prose, no fluff. Schema-constrained responses.

## Reference Implementation

See `examples/jetbrains-elvish/` for patterns Trinity will port to Go:
- `ralph.elv` - Full loop implementation
- `prd.json` - 60+ stories with dependencies
- `prompt.md` - Story execution template
