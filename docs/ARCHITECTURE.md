# Trinity Architecture

Technical architecture and design decisions.

## Overview

Trinity is built as a Go monorepo with clear separation between core logic, CLI, and GUI.

```
trinity/
├── go.work              # Go workspace (ties modules together)
├── core/                # Shared logic (separate go.mod)
│   ├── config/          # Config loading/saving
│   ├── db/              # Database API layer
│   ├── loop/            # Dev loop logic
│   ├── claude/          # Claude Code integration
│   └── prd/             # PRD/story management
├── cli/                 # CLI app (imports core)
│   ├── cmd/trinity/     # main.go entrypoint
│   └── internal/        # CLI-specific code
├── gui/                 # Wails desktop app (v0.2)
├── prompts/             # Embedded via go:embed
│   ├── templates/       # Prompts with {{placeholders}}
│   ├── schemas/         # Expected JSON response formats
│   └── internal/        # Internal command prompts
├── examples/            # Reference implementations
└── docs/                # Documentation
```

**Key principles:**
- `core/` contains all shared logic - imported by both CLI and GUI
- Each component has its own `go.mod` for clean dependency boundaries
- `go.work` enables local development without publishing modules
- Prompts embedded in CLI binary via `go:embed`

---

## Storage

All Trinity data lives in `~/.trinity/` - user projects stay clean.

```
~/.trinity/
├── auth.json                         # OAuth tokens, subscription
├── config.json                       # Global preferences
├── sessions/                         # Wizard progress, temp data
│   └── <id>.json
├── projects/
│   └── <project-hash>/
│       ├── config.json               # Project config
│       ├── trinity.db                # SQLite: PRD, agents, activity, learnings
│       └── workspaces/
│           ├── trunk/                # Default workspace (actual repo)
│           └── feature-<name>/       # Isolated clone (auto-managed)
│               └── repo/             # Full repo clone
```

**User's project:** Only gets optional CLAUDE.md. All other state in `~/.trinity/`.

---

## Database Layer

All state lives in SQLite (`trinity.db`). Trinity provides a typed Go API.

### Schema

```sql
-- PRD Structure (priority optional: critical, high, medium, low)
phases (id, name, status, depends_on, priority)
epics (id, phase_id, name, path, status, depends_on, priority)
stories (id, epic_id, title, intent, acceptance, status, depends_on, priority,
         human_testing_required, human_testing_instructions, human_testing_url,
         human_testing_status)

-- Agent Tracking
agents (id, workspace, epic, current_story, pid, status, started_at)

-- Activity Logs
activity_logs (id, timestamp, agent, action, message, story_ref)

-- Tags (shared across PRD and learnings)
tags (id, name)

-- PRD Tags (many-to-many)
phase_tags (phase_id, tag_id)
epic_tags (epic_id, tag_id)
story_tags (story_id, tag_id)

-- Learnings
learnings (id, content, created_at, updated_at)
learning_tags (learning_id, tag_id)
```

### DB API (`core/db`)

```go
// PRD operations
db.Phases.List(opts)                    // Filter by status, tags
db.Phases.Get(id)
db.Phases.Create(phase)
db.Epics.List(phaseID, opts)
db.Epics.GetByPath("mvp:auth")
db.Epics.Create(epic)
db.Stories.List(epicID, opts)
db.Stories.Get(id)
db.Stories.GetNext()                    // Next runnable (deps met, not blocked)
db.Stories.Insert(story)
db.Stories.Update(id, changes)
db.Stories.Move(from, to)               // Renumber, update all refs
db.Stories.Skip(id)
db.Stories.Retry(id)

// Dependency resolution
db.Dependencies.Check(ref)              // Returns unmet deps
db.Dependencies.Resolve(ref)            // Mark as satisfied
db.Dependencies.Graph()                 // Full dependency graph

// Tag queries
db.Tags.List()
db.Tags.Find(name)
db.Tags.Create(name)
db.Stories.ByTag("auth", "frontend")    // AND query
db.Epics.ByTag("critical")
db.Learnings.ByTag("gotcha")

// Activity
db.Activity.Log(agent, action, message, storyRef)
db.Activity.Recent(limit)
db.Activity.ForStory(storyID)
db.Activity.ForAgent(agentID)
db.Activity.Search(query)               // Full-text search

// Learnings
db.Learnings.List(opts)
db.Learnings.Search(keywords)           // Full-text search
db.Learnings.Insert(content, tags)
db.Learnings.Update(id, content, tags)
db.Learnings.Related(storyID)           // By shared tags
db.Learnings.ForTags(tags)              // Get relevant before acting

// Agents
db.Agents.List()
db.Agents.Register(workspace, epic)
db.Agents.Heartbeat(id)
db.Agents.Current(id)                   // What's it working on?
db.Agents.Stale(timeout)                // Find crashed agents
db.Agents.Release(id)
db.Agents.Cleanup()                     // Remove finished/crashed
```

### Queue Processing

Claude Code never writes to DB directly - calls `trinity internal` commands.

```
Claude A: signals "learn X" → keeps working (fire and forget)
Claude B: signals "complete Y" → keeps working
                    ↓
            Trinity Queue
                    ↓
        Process one at a time:
          1. Pop item
          2. Run item's prompt (if needed)
          3. Wait for completion
          4. Write to DB
          5. Next item
```

Workers don't block. Trinity processes queue sequentially - no parallel writes, no conflicts.

---

## Prompt System

### Structure

```
prompts/
├── templates/                    # User-facing prompts
│   ├── init-analyze.md           # Analyze project during init
│   ├── init-claude-md.md         # Generate CLAUDE.md
│   ├── analyze.md                # Deep codebase analysis
│   ├── plan-add-init.md           # Create new PRD
│   ├── plan-add-extend.md         # Add to existing PRD
│   ├── plan-refine.md             # Improve stories
│   └── story-execute.md          # Execute a story
├── schemas/                      # Expected JSON response formats
│   ├── plan-add.json
│   ├── plan-refine.json
│   ├── analyze.json
│   └── ...
└── internal/                     # Internal command prompts
    ├── learn.md                  # Check dups, format, integrate
    ├── complete.md               # Validate completion, update deps
    ├── add-story.md              # Check structure, assign ID
    └── move-story.md             # Handle renumbering, update refs
```

### Communication Flow

```
1. CLI fills template:
   plan-add.md + {existing_prd, user_input}

2. Sends to Claude with response schema

3. Claude returns structured JSON:
   {
     "analysis": "Looks like it belongs in auth...",
     "suggestions": [
       {"id": 1, "type": "story", "parent": "mvp:auth", "after": "STORY-1.1.2"},
       {"id": 2, "type": "epic", "parent": "mvp", "after": "auth"}
     ],
     "generated": {
       "title": "Password reset",
       "intent": "Allow users to...",
       "acceptance": ["..."]
     }
   }

4. CLI parses → renders menu → user picks → next step
```

### Token Optimization

- Minimal context - only send what's needed (not full PRD if one epic relevant)
- Structured JSON output - no prose, no "Sure, I'd be happy to..."
- Schema-constrained responses - Claude knows exact format expected
- Incremental context - load more only when needed
- Cache common patterns - don't re-analyze unchanged code

---

## Branching Strategy

```
main (stable releases)
  ↑
dev (integration) ← features merge here
  ↑
feature branches (auto-managed by trinity run)
```

**Flow:**
1. `trinity run mvp:auth` branches from `dev`
2. Work completes → auto-PR → merges to `dev`
3. Dependencies resolve when code is in `dev`
4. New work branches from `dev` (already has merged code)
5. `trinity release` merges `dev` → `main`

---

## Docker Isolation

Optional safety layer for running Claude Code in containers.

```bash
docker run \
  -v /path/to/project:/workspace \      # Project (read-write)
  -v ~/.trinity:/root/.trinity \        # State persists
  trinity run
```

**Benefits:**
- Filesystem isolation - AI can only access mounted `/workspace`
- Resource limits - CPU/memory caps prevent runaway processes
- Network restrictions - can limit or disable network access
- Easy cleanup - container removal is clean

**Data safety:**
- Git commits → pushed to remote (safe)
- `~/.trinity/` → mounted volume (persists)
- Project files → mounted volume (persists)
- Only at-risk: uncommitted WIP if container crashes mid-story

**Requirements:**
- Docker installed and running
- Claude CLI pre-installed in container image
- Git credentials available (mount or env vars)

---

## Technical Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| CLI | Go | Fast, single binary, good CLI ecosystem |
| GUI (v0.2) | Wails | Go-based, auto TS bindings, lighter than Electron |
| Database | SQLite | Embedded, single file, handles concurrent writes |
| AI | Claude Code CLI | Execution engine, not just API |

---

## PRD Structure

### Hierarchy

```
Phase → Epic → Story
```

- **Phase**: Major milestone ("MVP", "Growth", "Polish")
- **Epic**: Complete feature ("Auth", "Payments")
- **Story**: Single implementable task ("Add login form")

### Dependency Syntax

Universal 3-level hierarchy:

```
"mvp"                        → whole phase
"mvp:auth"                   → epic in phase
"mvp:auth:STORY-1.1.2"       → specific story
```

A phase can depend on a story. An epic can depend on a story. Maximum flexibility.

### Story Format

```json
{
  "id": "STORY-1.2.3",
  "title": "Story title",
  "intent": "Why this matters",
  "acceptance": ["Criterion 1", "Criterion 2"],
  "priority": "high",
  "depends_on": ["mvp:auth:STORY-1.1.1"],
  "human_testing": {
    "required": true,
    "instructions": "Test login with valid/invalid credentials",
    "url": "/login"
  }
}
```

---

## Autonomous Loop

1. Query DB for next story (deps met, not blocked)
2. Create feature branch (auto-managed workspace)
3. Run Claude Code to implement
4. Self-review and iterate
5. If `human_testing.required`: pause for manual verification
6. Create PR, merge to dev
7. Repeat until all stories complete
