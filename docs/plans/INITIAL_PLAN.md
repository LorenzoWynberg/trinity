# Trinity - Initial Plan

## Vision

A framework/tool for creating and running autonomous AI development loops (like Ralph) for any project. Think "Ralph-as-a-service" - point it at a project, define stories, let it build while you're AFK.

## Core Concepts

### What is an Autonomous Dev Loop?
An autonomous development loop that:
1. Reads a PRD (Product Requirements Document) with stories
2. Picks the next story based on dependencies
3. Creates a feature branch
4. Runs Claude Code to implement the story
5. Self-reviews and iterates
6. Creates PR, merges, cleans up
7. Repeats until all stories complete

### What is Trinity?
A tool that:
- **Scaffolds** autonomous dev loop setups for any project
- **Manages** project configurations
- **Provides** CLI and GUI interfaces
- **Tracks** progress across projects

## Features

### MVP (v0.1)

#### CLI Commands

Trinity has a minimal, focused command set:

**Auth & Billing:**
```bash
trinity auth login              # Browser OAuth (Google/GitHub), required
trinity auth logout             # Clear local auth session
trinity auth status             # Show subscription/auth status
```

**Setup:**
```bash
trinity init                    # Smart init with Claude (analyzes project)
```

**Analysis:**
```bash
trinity analyze                 # Deep dive on codebase, suggest what to build
```

**PRD Management:**
```bash
trinity prd add                 # Context-aware: creates PRD or adds to existing
trinity prd show                # Full PRD tree with status
trinity prd show mvp:auth       # Specific phase/epic/story
trinity prd show --next         # What runs next
trinity prd show --blocked      # Show blocked items
trinity prd show --awaiting-review  # Human testing pending
trinity prd refine              # AI review and improve stories
trinity prd skip <ref>          # Mark as skipped
trinity prd retry <ref>         # Reset to pending
```

**Execution:**
```bash
trinity run                     # Run loop (auto-manages workspaces)
trinity run --all               # All valid work in parallel
trinity run mvp                 # Run whole phase
trinity run mvp:auth            # Run specific epic
trinity run mvp:auth:STORY-1.1.2  # Run specific story
trinity run <ref> --with-deps   # Run deps first, then target
trinity run --docker            # Run in isolated container
trinity run --attach            # Attach to running loop
trinity run --stop              # Graceful stop after current story
trinity run --kill              # Hard stop
```

**Human Testing:**
```bash
trinity approve                 # Approve current pending test
trinity reject "feedback"       # Reject with feedback, Claude iterates
```

**Status & Config:**
```bash
trinity status                  # Overview: agents, progress, blocked items
trinity config show             # Show configuration
trinity config set KEY VALUE    # Set config value
trinity config edit             # Open config in editor
```

**Ship:**
```bash
trinity hotfix "desc"           # Fast lane for quick fixes
trinity hotfix "desc" --target main  # PR directly to main (urgent)
trinity release                 # Merge dev → main
trinity release --tag v1.0.0    # Merge and tag
```

**Internal (Claude's API):**
```bash
trinity internal complete <story>           # Mark story done
trinity internal add-story <epic> "title"   # Add story
trinity internal log "message"              # Write to activity
trinity internal learn "content" --tags x,y # Add learning
trinity internal move-story <from> <to>     # Renumber, update refs
```

#### Auto Workspace Management

`trinity run` automatically manages workspaces - no manual feature commands needed:

```bash
$ trinity run mvp:auth
Creating workspace for mvp:auth...
Branching from dev to feature/mvp-auth
[auth] STORY-1.1.1 Creating user signup...

$ trinity run --all
Starting parallel execution...
[auth]     STORY-1.1.1 Creating user signup...
[payments] STORY-2.1.1 Adding Stripe integration...
```

Each parallel execution:
- Gets its own repo clone (so changes don't conflict)
- Runs independently with its own Claude Code instance
- Auto-merges back via PR when complete
- Workspace auto-cleaned after merge

#### Branching Strategy

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
3. Other work depends on `mvp:auth:STORY-1.1.2`? Trinity checks: is that commit in `dev`?
4. Yes → dependent work can start (branches from `dev`, already has the code)
5. When stable, `trinity release` merges `dev` → `main`

**Dependency resolution:**
- Dependencies resolve when code is in `integration_branch` (default: `dev`)
- If no `dev` branch configured, falls back to `main`
- Parallel work enabled while ensuring code availability

**Dependency validation:**
```bash
$ trinity run mvp:payments:STORY-2.1.1

⚠ Cannot run mvp:payments:STORY-2.1.1
  Unmet dependencies:
    - mvp:auth:STORY-1.1.2 (pending)

  Use --with-deps to run dependencies first, then this story.

$ trinity run mvp:payments:STORY-2.1.1 --with-deps

Running dependencies first:
  → mvp:auth:STORY-1.1.2 ... ✓ merged to dev
Then running:
  → mvp:payments:STORY-2.1.1 ...

# If dependency is already being worked on:
$ trinity run mvp:payments:STORY-2.1.1 --with-deps

⚠ Cannot proceed with mvp:payments:STORY-2.1.1
  Dependency in progress by another agent:
    - mvp:auth:STORY-1.1.2 (agent-2, started 5m ago)

  Marked mvp:payments:STORY-2.1.1 as blocked.
  Will auto-resume when dependency completes.
```

#### PRD Management

**`trinity prd add` (no PRD exists):**
```
Trinity: What are you building?
> Task management API

Trinity: Tech stack?
> Go, PostgreSQL

[AI generates PRD]

Trinity: Generated:
  Phase: MVP
  ├── Epic: Auth (3 stories)
  └── Epic: Tasks (4 stories)

  [I]mplement  [R]efine  [S]how  [O]ver
> r

Trinity: What to refine?
> Split auth into separate epics

[Loop until user picks Implement]
```

**`trinity prd add` (PRD exists):**
```
Trinity: What to add?
> Password reset

[AI analyzes existing PRD]

Trinity: Looks like it belongs in mvp:auth.
  [1] New story after STORY-1.1.2 → becomes 1.1.3
  [2] New epic after auth
  [3] Specify manually...
> 1

Trinity: Priority? [C]ritical [H]igh [M]edium [L]ow
> m

Trinity: Tags (comma separated)?
> auth, email

[Confirm → creates with proper renumbering → implements]
```

#### Hotfix (fast lane for quick fixes)

```
$ trinity hotfix "login button broken on mobile"

Trinity: Analyzing...

  Found issue in src/components/LoginButton.tsx
  - onClick missing touch event

  [V]iew diff  [A]pply  [R]efine  [C]ancel

> a

Trinity: Applied fix, tests passing.

  [P]R to dev  [M]ain (urgent)  [C]ommit only  [R]evert

> p

Trinity: Created PR #42 → dev
  Branch: hotfix/login-button-touch
```

Hotfix characteristics:
- No phase/epic/story overhead
- Creates `hotfix/<name>` branch
- PRs to `integration_branch` by default (or `--target`)
- Auto-logged in activity

#### Human Testing Gates

Some stories require manual verification (UI changes, UX flows, visual design). Mark these with `human_testing`:

```json
{
  "id": "STORY-1.2.3",
  "title": "Add login form",
  "human_testing": {
    "required": true,
    "instructions": "Test login with valid/invalid credentials",
    "url": "/login"
  }
}
```

**Project config for dev server:**
```json
{
  "dev_cmd": "npm run dev",
  "dev_port": 3000,
  "dev_ready_signal": "ready on"
}
```

**Flow when `human_testing.required` is true:**
```
1. Trinity implements story
2. Self-review passes
3. Trinity starts dev server (dev_cmd)
4. Waits for dev_ready_signal in stdout
5. Notifies user:

   ┌────────────────────────────────────────┐
   │ 🧪 Human Testing Required              │
   │                                        │
   │ Story: STORY-1.2.3 "Add login form"    │
   │ URL: http://localhost:3000/login       │
   │                                        │
   │ Instructions:                          │
   │   Test login with valid/invalid creds  │
   │                                        │
   │ [A]pprove  [R]eject  [S]kip            │
   └────────────────────────────────────────┘

6. User tests manually, then responds:
   - Approve → mark complete, continue to next story
   - Reject → enter feedback, Claude iterates on implementation
   - Skip → mark as needs_review, continue (can revisit later)
```

#### Storage

```
~/.trinity/
├── auth.json                         # Global auth/subscription
├── config.json                       # Global config
├── projects/
│   └── <project-hash>/
│       ├── config.json               # Project config
│       ├── trinity.db                # All state: PRD, agents, activity, learnings
│       └── workspaces/
│           ├── trunk/                # Default - works on actual repo
│           └── feature-<name>/       # Auto-managed isolated workspace
│               └── repo/             # Full repo clone
```

**Hierarchy:** Phase → Epic → Story

- **Phase**: Major milestone ("MVP", "Growth", "Polish")
- **Epic**: Complete feature ("Auth", "Payments")
- **Story**: Single implementable task ("Add login form")

**Universal dependency syntax** (3-level hierarchy):
```
"mvp"                        → whole phase
"mvp:auth"                   → epic in phase
"mvp:auth:STORY-1.1.2"       → specific story
```

A phase can depend on a story. An epic can depend on a story. Maximum flexibility, minimum artificial blocking.

- User's project stays completely clean - no scaffolded files
- All state in SQLite - efficient queries, concurrent writes handled
- Agent tracking - auto-recover crashed processes

#### Database Layer

All state lives in SQLite (`trinity.db`). Trinity provides a clean API layer.

**Schema:**
```sql
-- PRD Structure (priority optional: critical, high, medium, low)
phases (id, name, status, depends_on, priority)
epics (id, phase_id, name, path, status, depends_on, priority)
stories (id, epic_id, title, intent, acceptance, status, depends_on, priority,
         human_testing_required, human_testing_instructions, human_testing_url,
         human_testing_status)  -- status: pending, approved, rejected

-- Agent Tracking
agents (id, workspace, epic, current_story, pid, status, started_at)

-- Activity Logs
activity_logs (id, timestamp, agent, action, message, story_ref)

-- Tags (shared across PRD and learnings)
tags (id, name)                           -- "auth", "frontend", "urgent", etc.

-- PRD Tags (many-to-many)
phase_tags (phase_id, tag_id)
epic_tags (epic_id, tag_id)
story_tags (story_id, tag_id)

-- Learnings
learnings (id, content, created_at, updated_at)
learning_tags (learning_id, tag_id)
```

**DB API (`core/db`):**
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

**Queue processing (sequential):**
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

**Each internal command has its own prompt:**
```
prompts/internal/
├── learn.md          # Check dups, format, integrate
├── complete.md       # Validate completion, update deps
├── add-story.md      # Check structure, assign ID, validate deps
├── move-story.md     # Handle renumbering, update all refs
└── ...
```

Not dumb writes - each command handled intelligently by its prompt.

#### Docker Isolation (optional)

For users who want an extra safety layer, Trinity can run Claude Code inside Docker containers:

```bash
trinity run --docker            # Run in isolated container
trinity run --all --docker      # All work in containers
```

**What gets mounted:**
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
- Only at-risk: uncommitted WIP if container crashes mid-story (same as local)

**Requirements:**
- Docker installed and running
- Claude CLI pre-installed in container image
- Git credentials available (mount or env vars)

#### Smart Init

Instead of static templates, `trinity init` uses Claude to understand the project:

1. Run `init-analyze.md` prompt → get project summary (stack, build cmd, structure)
2. Run `init-claude-md.md` prompt → generate CLAUDE.md in project (if missing)
3. Create empty PRD in `~/.trinity/projects/<hash>/trinity.db`

**Storage:** All Trinity data lives in `~/.trinity/` - user's project stays clean except for optional CLAUDE.md.

#### Orchestration

Trinity isn't just a loop runner - it's an orchestrator. The flow is: **analyze → prd add → run**.

**Example flow:**
```
$ trinity analyze

Trinity: Analyzing your project...

  Stack: Go with Chi router
  Structure: Clean architecture (handlers/, services/, models/)
  Tests: 47% coverage, mainly unit tests

  Suggestions:
  - Add authentication (no auth currently)
  - Add rate limiting to API endpoints
  - Increase test coverage for services/

$ trinity prd add
> Add user authentication

Trinity: I see you're using Go with Chi router. I'd suggest:
- JWT-based auth
- Middleware pattern
- 4 stories: signup, login, middleware, protected routes

  [I]mplement  [R]efine  [S]how  [O]ver
> i

[Creates stories, starts implementation]
```

**Prompt Templates & Response Schemas:**
```
prompts/
├── templates/                    # Prompts with {{placeholders}}
│   ├── init-analyze.md
│   ├── init-claude-md.md
│   ├── analyze.md                # Deep codebase analysis
│   ├── prd-add-init.md           # prd add when no PRD exists
│   ├── prd-add-extend.md         # prd add when PRD exists
│   ├── prd-refine.md
│   └── story-execute.md
├── schemas/                      # Expected JSON response formats
│   ├── prd-add.json
│   ├── prd-refine.json
│   └── ...
└── internal/                     # Internal command prompts
    ├── learn.md
    ├── complete.md
    ├── add-story.md
    └── move-story.md
```

**CLI ↔ Claude communication:**
```
1. CLI fills template:
   prd-add.md + {existing_prd, user_input}

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

**Session state:**
```
~/.trinity/sessions/<id>.json    # Wizard progress, temp data
```

Claude always returns parseable JSON, CLI handles rendering/UX.

**Token optimization principles:**
- Minimal context - only send what's needed (not full PRD if one epic relevant)
- Structured JSON output - no prose, no "Sure, I'd be happy to..."
- Schema-constrained responses - Claude knows exact format expected
- Incremental context - load more only when needed
- Cache common patterns - don't re-analyze unchanged code

**AI has internal tools** for PRD management (insert, move, renumber, etc.). Users go through AI for judgment:
```
User: "Add a story between login and password reset"

AI: [queries db.Learnings.ForTags(["auth"]) for context]
    [sees STORY-1.1.2 is complete]

    "STORY-1.1.2 (login) is already complete. Inserting will
     renumber it to 1.1.3. This won't affect code, just IDs.

     Options:
     1. Insert anyway
     2. Add to end of epic instead

     What do you prefer?"

User: "1"

AI: [runs internal insert tool]
    [db.Stories.Move() updates refs]
    [db.Activity.Log() records the action]

    "Done. Created mvp:auth:STORY-1.1.3 'Add session management'"
```

#### Requirements
- **Claude Code** - Required. Trinity uses Claude Code as its execution engine (not just an LLM API). Claude Code handles file I/O, bash commands, tool loops, context management.
- **Paid subscription** - Required. No trial mode; users must authenticate via OAuth (Google/GitHub) before running commands.

### v0.2 - GUI

#### Desktop App (Wails)
- Project management dashboard
- Visual PRD editor (drag-drop stories, dependencies)
- Real-time streaming output
- Progress visualization
- Multi-project view

#### Features
- Create/edit PRDs visually
- Watch multiple projects running
- Pause/resume/stop controls
- History and logs viewer

### v1.0 - Full Platform

- Cloud sync for PRDs/progress
- Team collaboration
- Custom template marketplace
- Analytics and insights
- CI/CD integration

## Architecture

Monorepo with Go workspaces for clean separation:

```
trinity/
├── go.work              # Go workspace (ties modules together)
├── core/                # Shared logic (separate go.mod)
│   ├── go.mod
│   ├── config/          # Config loading/saving
│   ├── db/              # Database API layer
│   ├── loop/            # Dev loop logic
│   ├── claude/          # Claude Code integration
│   └── prd/             # PRD/story management
├── cli/                 # CLI app (separate go.mod, imports core)
│   ├── go.mod
│   ├── cmd/
│   │   └── trinity/     # main.go entrypoint
│   └── internal/        # CLI-specific code
├── gui/                 # Wails app v0.2 (separate go.mod, imports core)
│   └── ...              # wails init structure later
├── prompts/             # Embedded into CLI via go:embed
│   ├── templates/
│   │   ├── init-analyze.md
│   │   ├── analyze.md
│   │   ├── prd-add-init.md
│   │   ├── prd-add-extend.md
│   │   └── story-execute.md
│   ├── schemas/
│   │   ├── prd-add.json
│   │   └── ...
│   └── internal/
│       ├── learn.md
│       ├── complete.md
│       ├── add-story.md
│       └── move-story.md
├── examples/            # Example implementations
└── docs/
    ├── plans/
    └── guides/
```

**Key principles:**
- `core/` contains all shared logic - imported by both CLI and GUI
- `core/db/` provides clean API for all database operations
- Each component has its own `go.mod` for clean dependency boundaries
- `go.work` enables local development without publishing modules
- Prompts embedded in CLI binary via `go:embed`

## Technical Stack

### CLI
- **Go** - Fast development, simple codebase, good CLI ecosystem

### GUI Framework (v0.2)
- **Wails** - Go-based, auto-generated TypeScript bindings, fast builds

### AI Integration
- **Claude Code CLI only** - Shell out to `claude` command
- No API fallback needed - Claude Code IS the execution engine

### Database
- **SQLite** - Single file, embedded, handles concurrent writes
- Clean API layer in `core/db/`

## Decisions Made

- **Name:** Trinity
- **Claude Code required** - It's the execution engine, not a swappable provider
- **Commercial** - Closed source commercial product
- **CLI in Go** - Fast development, simple codebase, single binary
- **GUI in Wails** - Go-based, auto-generated TS bindings, lighter than Electron
- **Smart init** - Claude analyzes project and generates tailored setup (not static templates)
- **Target** - Solo devs first, team features in v1.0
- **Monetization** - Subscription, likely ~$5/month (tentative)
- **Auth** - OAuth browser login (Google/GitHub), no trial mode
- **Global storage** - All Trinity data in `~/.trinity/`, user projects stay clean (only CLAUDE.md added)
- **Auto workspaces** - `trinity run` manages workspaces automatically, no manual feature commands
- **All state in SQLite** - Activity, learnings, PRD, agents in one DB with clean API

## Questions Remaining

1. How do we handle different project types?
   - AI figures it out from project structure via smart init
   - Example implementations for reference

## Next Steps

1. [x] Decide on CLI language → **Go**
2. [x] Decide on GUI framework → **Wails**
3. [ ] Create basic CLI scaffold
4. [ ] Implement `core/db/` API layer
5. [ ] Port loop logic from jetbrains-elvish Ralph
6. [ ] Create meta-prompts for smart init
7. [ ] Test on a new project
8. [ ] Iterate based on feedback

## Inspiration

- Claude Code - AI coding assistant
- Cursor - AI-first code editor
- Devin - Autonomous AI developer
- GPT Engineer - AI code generation
- Aider - AI pair programming
