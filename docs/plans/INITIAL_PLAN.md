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

**Auth & Billing:**
```bash
trinity auth login              # Browser OAuth (Google/GitHub), required
trinity auth logout             # Clear local auth session
trinity auth status             # Show subscription/auth status
```

**Chat & Planning:**
```bash
trinity chat                    # Interactive mode - discuss, plan, orchestrate
trinity analyze                 # Deep dive on codebase, suggest next steps
trinity plan "add auth"         # Generate implementation plan for a feature
trinity plan show               # Show current plan
trinity plan approve            # Approve plan, generate stories
```

**PRD Management:**
```bash
trinity prd generate            # Turn rough idea/plan into structured stories
trinity prd refine              # AI review and improve existing stories
trinity prd show                # Show full PRD
```

**Run Loop:**
```bash
trinity run                     # Run loop (foreground, streaming output)
trinity run --bg                # Run in background
trinity run --once              # Single story only
trinity watch                   # Attach to running loop, stream output
trinity finish                  # Complete current story, then exit gracefully
trinity kill                    # Hard stop immediately
```

**Init:**
```bash
trinity init                    # Smart init with Claude (analyzes project)
```

**Features (Parallel Workspaces):**
```bash
trinity feature create "auth"         # Clone repo into isolated workspace
trinity feature create "payments"     # Another parallel feature
trinity feature list                  # Show all features and status
trinity feature list --available      # Only features ready to start (deps met)
trinity feature suggest               # Suggest parallelization opportunities
trinity feature switch auth           # Switch context to feature
trinity feature status auth           # Show feature progress
trinity feature merge auth            # Create PR to merge feature back
trinity feature delete auth           # Cleanup workspace after merge
trinity feature config auth --auto-merge=true  # Per-feature settings
```

**Parallel Execution:**
```bash
trinity run                           # Run current feature/workspace
trinity run --all                     # Run ALL valid features in parallel
trinity run mvp                       # Run whole phase
trinity run mvp:auth                  # Run specific epic
trinity run mvp:auth:STORY-1.1.2      # Run specific story (to unblock deps)
trinity watch --all                   # Watch all running features
trinity status                        # Show all agents and what they're working on
trinity recover                       # Restart any crashed agents
```

**Feature Defaults:**
- `--auto-pr=true` - Creates PR when feature completes (safe default)
- `--auto-merge=false` - Requires opt-in (user should review)

**Branching Strategy (dev branch integration):**
```
main (stable releases)
  ↑
dev (integration) ← features merge here
  ↑
feature-auth, feature-payments, etc.
```

```bash
trinity config set integration_branch dev    # Set integration branch
trinity feature create payments              # Clones from dev (has merged code)
trinity release                              # Merge dev → main
```

**Flow:**
1. `feature-auth` completes → auto-PR → merges to `dev`
2. `feature-payments` depends on `mvp:auth:STORY-1.1.2`
3. Trinity checks: is that commit in `dev`? Yes → payments can start
4. `feature-payments` clones from `dev` (already has auth code)
5. When stable, `trinity release` merges `dev` → `main`

**Dependency resolution:**
- Dependencies resolve when code is in `integration_branch` (default: `dev`)
- If no `dev` branch configured, falls back to `main`
- This enables parallel features while ensuring code availability

**Dependency validation:**
- Before running anything, Trinity checks all dependencies
- Unmet deps → warning with what's missing, won't start
- `--force` runs dependencies first, then the requested item
```bash
$ trinity run mvp:payments:STORY-2.1.1

⚠ Cannot run mvp:payments:STORY-2.1.1
  Unmet dependencies:
    - mvp:auth:STORY-1.1.2 (pending)

  Use --force to run dependencies first, then this story.

$ trinity run mvp:payments:STORY-2.1.1 --force

Running dependencies first:
  → mvp:auth:STORY-1.1.2 ... ✓ merged to dev
Then running:
  → mvp:payments:STORY-2.1.1 ...
```

**PRD Management (interactive wizards):**
```bash
trinity prd create              # Full wizard: gather info → generate → refine loop → implement
trinity prd add                 # Add phase/epic/story with AI placement suggestions
trinity prd refine              # AI reviews PRD, suggests improvements
trinity prd show                # Show full PRD tree
trinity prd show mvp:auth       # Show specific phase/epic
```

**`trinity prd create` wizard:**
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

**`trinity prd add` wizard:**
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

[Confirm → creates with proper renumbering]
```

**Quick commands (scripting/power users):**
```bash
trinity list                    # List all stories with status
trinity list --pending          # Only pending
trinity show mvp:auth:STORY-1.1.1  # Show story details
trinity skip <story>            # Mark as skipped
trinity retry <story>           # Reset to pending
trinity next                    # Show what runs next
```

**Management:**
```bash
trinity status                  # Progress overview
trinity reset                   # Clear progress (keep config)
trinity reset --hard            # Remove project from ~/.trinity/ entirely
trinity config show             # Show configuration
trinity config set KEY VALUE    # Set config value
trinity config edit             # Open config in editor
```

**Releases:**
```bash
trinity release                 # Merge dev → main (PR or direct)
trinity release --dry-run       # Show what would be released
trinity release --tag v1.0.0    # Merge and tag
```

**Storage & Workspaces:**
```
~/.trinity/
├── auth.json                         # Global auth/subscription
├── config.json                       # Global config
├── projects/
│   └── <project-hash>/
│       ├── config.json               # Project config
│       ├── trinity.db                # All PRD, agents, activity, learnings
│       └── workspaces/
│           ├── trunk/                # Default - works on actual repo
│           │   └── logs/
│           └── feature-<name>/       # Isolated feature workspace
│               ├── repo/             # Full repo clone
│               └── logs/
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
- All PRD data in SQLite - efficient queries, concurrent writes handled
- Epic-level dependencies - know which features are valid to start
- Story-level dependencies - order within features + cross-epic refs
- Agent tracking - recover crashed processes

**SQLite for shared state:**
```
~/.trinity/projects/<hash>/trinity.db
```
- All PRD state, agent tracking, activity logs, learnings in one DB
- Handles concurrent writes (multiple agents running)
- Claude never writes directly - calls `trinity internal` commands
- Trinity is the single coordinator for ALL shared writes

**Schema:**
```sql
-- PRD Structure (priority optional but encouraged: critical, high, medium, low)
phases (id, name, status, depends_on, priority)
epics (id, phase_id, name, path, status, depends_on, priority)
stories (id, epic_id, title, intent, acceptance, status, depends_on, priority)

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

Priority enum: `critical`, `high`, `medium`, `low` (optional but encouraged during PRD generation).

**Internal commands (Claude calls these):**
```bash
trinity internal complete <story>           # Mark story done
trinity internal add-story <epic> "title"   # Add story
trinity internal log "message"              # Write to activity log
trinity internal learn "topic" "pattern"    # Add to learnings
trinity internal move-story <from> <to>     # Renumber, update refs
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
├── learn.md          # Check dups, format, integrate, update index
├── log.md            # Structure activity log entry
├── complete.md       # Validate completion, update deps
├── add-story.md      # Check structure, assign ID, validate deps
├── move-story.md     # Handle renumbering, update all refs
└── ...
```

Not dumb writes - each command handled intelligently by its prompt.

**Activity & Learnings:**
```
~/.trinity/projects/<hash>/
├── activity/
│   └── YYYY-MM-DD.md         # Daily logs (decisions, issues, progress)
└── learnings/
    ├── index.json            # Quick lookup by keyword
    ├── auth.md               # Topic-specific patterns
    ├── database.md
    └── gotchas.md            # Things that tripped us up
```

AI layer:
- **Before acting**: Checks `learnings/index.json` → reads relevant topic files
- **After acting**: Logs to `activity/`, updates `learnings/` if new pattern
- **Corrections**: Uses Was/Now/Why format when fixing misconceptions
- `trunk` workspace operates on actual repo (no clone)
- Feature workspaces clone repo so multiple Claudes can work simultaneously

#### Smart Init
Instead of static templates, `trinity init` uses Claude to understand the project:

1. Run `init-analyze.md` prompt → get project summary (stack, build cmd, structure)
2. Run `init-claude-md.md` prompt → generate CLAUDE.md in project (if missing) - this is for Claude Code
3. Run `init-prompt-md.md` prompt → generate tailored prompt.md in `~/.trinity/projects/<hash>/`
4. Create starter `prd.json` in `~/.trinity/projects/<hash>/` (empty, ready for stories)

**Storage:** All Trinity data lives in `~/.trinity/` - user's project stays clean except for optional CLAUDE.md.

#### Parallel Features

Trinity supports multiple features being developed simultaneously in isolated workspaces:

```bash
$ trinity feature create "auth"
Creating workspace for 'auth'...
Cloning repo to ~/.trinity/projects/.../workspaces/feature-auth/repo/
Created empty PRD. Use `trinity chat` or `trinity prd generate` to add stories.

$ trinity feature create "payments"
Creating workspace for 'payments'...

$ trinity run --all
Starting 2 features in parallel...
[auth]     STORY-1.1.1 Creating user signup...
[payments] STORY-1.1.1 Adding Stripe integration...
```

Each feature:
- Gets its own repo clone (so changes don't conflict)
- Has its own PRD (scoped to that feature)
- Runs independently with its own Claude Code instance
- Eventually merges back via PR

#### Orchestration

Trinity isn't just a loop runner - it's an orchestrator with built-in "skills". Users talk to Trinity, Trinity executes the right workflow via Claude Code.

**Example flow:**
```
$ trinity chat
> I want to add user authentication

Trinity: Let me analyze your project first...
[runs analyze prompt via Claude Code]

Trinity: I see you're using Go with Chi router. I'd suggest:
- JWT-based auth
- Middleware pattern
- 4 stories: signup, login, middleware, protected routes

Want me to generate these stories? [Y/n]
> y

[runs prd-generate prompt via Claude Code]
Added 4 stories to your PRD. Run `trinity list` to see them.
```

**Meta-prompts** (ship with Trinity, embedded via go:embed):
- `prompts/init-analyze.md` - Analyze project structure
- `prompts/init-claude-md.md` - Generate CLAUDE.md
- `prompts/plan.md` - Break feature into implementation approach
- `prompts/prd-generate.md` - Turn plan into structured stories
- `prompts/prd-refine.md` - Review and improve story quality
- `prompts/story-execute.md` - The actual implementation loop
- `prompts/chat.md` - Interactive orchestration mode

**AI has internal tools** for PRD management (insert, move, renumber, etc.). Users go through AI for judgment:
```
User: "Add a story between login and password reset"

AI: [checks learnings/index.json for relevant context]
    [reads learnings/auth.md]
    [sees STORY-1.1.2 is complete]

    "STORY-1.1.2 (login) is already complete. Inserting will
     renumber it to 1.1.3. This won't affect code, just IDs.

     Options:
     1. Insert anyway
     2. Add to end of epic instead

     What do you prefer?"

User: "1"

AI: [runs internal insert tool]
    [updates prd/index.json]
    [logs to activity/2024-01-15.md]

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
├── prompts/             # Meta-prompts (embedded into cli via go:embed)
│   ├── init-analyze.md
│   ├── init-claude-md.md
│   ├── plan.md
│   ├── prd-generate.md
│   ├── prd-refine.md
│   ├── story-execute.md
│   ├── chat.md
│   └── internal/        # Prompts for internal commands
│       ├── learn.md
│       ├── log.md
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
- **Parallel workspaces** - Each feature gets isolated repo clone, multiple PRDs, run simultaneously

## Questions Remaining

1. How do we handle different project types?
   - AI figures it out from project structure via smart init
   - Example implementations for reference

## Next Steps

1. [x] Decide on CLI language → **Go**
2. [x] Decide on GUI framework → **Wails**
3. [ ] Create basic CLI scaffold
4. [ ] Port loop logic from jetbrains-elvish Ralph
5. [ ] Create meta-prompts for smart init
6. [ ] Test on a new project
7. [ ] Iterate based on feedback

## Inspiration

- Claude Code - AI coding assistant
- Cursor - AI-first code editor
- Devin - Autonomous AI developer
- GPT Engineer - AI code generation
- Aider - AI pair programming
