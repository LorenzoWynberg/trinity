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
2. `feature-payments` depends on `auth:STORY-1.1.2`
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

**Story Management:**
```bash
trinity list                    # List all stories with status
trinity list --pending          # Only pending stories
trinity list --done             # Only completed stories
trinity show STORY-1            # Show story details
trinity add                     # Add story (interactive by default)
trinity add "Title" --quick     # Quick add, title only
trinity add "Title" --accepts "..." --depends STORY-1  # Power user flags
trinity edit STORY-1            # Edit story in editor
trinity remove STORY-1          # Remove story from PRD
trinity skip STORY-1            # Mark as skipped
trinity retry STORY-1           # Reset story to pending
trinity next                    # Show what story would run next
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
│       ├── prd/
│       │   ├── index.json            # Phases, epics, deps, agents
│       │   └── phases/
│       │       ├── mvp/
│       │       │   ├── meta.json     # Phase metadata
│       │       │   └── epics/
│       │       │       ├── auth/
│       │       │       │   ├── meta.json
│       │       │       │   └── stories/
│       │       │       │       ├── STORY-1.1.1.json
│       │       │       │       └── STORY-1.1.2.json
│       │       │       └── core-api/
│       │       └── growth/
│       │           └── epics/
│       │               ├── payments/
│       │               └── notifications/
│       └── workspaces/
│           ├── trunk/                # Default - works on actual repo
│           │   ├── state.json
│           │   └── logs/
│           └── feature-<name>/       # Isolated feature workspace
│               ├── repo/             # Full repo clone
│               ├── state.json
│               └── logs/
```

**Hierarchy:** Phase → Epic → Story

- **Phase**: Major milestone ("MVP", "Growth", "Polish")
- **Epic**: Complete feature ("Auth", "Payments")
- **Story**: Single implementable task ("Add login form")

**index.json** - the brain:
```json
{
  "phases": {
    "mvp": {
      "name": "MVP",
      "depends_on": []
    },
    "growth": {
      "name": "Growth",
      "depends_on": ["mvp:auth:STORY-1.1.2"]
    }
  },
  "epics": {
    "auth": {
      "phase": "mvp",
      "path": "epics/auth",
      "depends_on": [],
      "status": "complete"
    },
    "payments": {
      "phase": "growth",
      "path": "epics/payments",
      "depends_on": ["mvp:auth:STORY-1.1.2"],
      "status": "in_progress"
    },
    "notifications": {
      "phase": "growth",
      "path": "epics/notifications",
      "depends_on": [],
      "status": "pending"
    }
  },
  "agents": {
    "feature-payments": {
      "workspace": "feature-payments",
      "epic": "payments",
      "current_story": "STORY-2.1.1",
      "pid": 12345,
      "started_at": "2024-01-15T10:00:00Z",
      "status": "running"
    }
  }
}
```

**Universal dependency syntax** (3-level hierarchy):
```
"mvp"                        → whole phase
"mvp:auth"                   → epic in phase
"mvp:auth:STORY-1.1.2"       → specific story
```

A phase can depend on a story. An epic can depend on a story. Maximum flexibility, minimum artificial blocking.
```

- User's project stays completely clean - no scaffolded files
- Modular PRD structure - no giant JSON files
- Epic-level dependencies - know which features are valid to start
- Story-level dependencies - order within features + cross-epic refs
- Agent tracking - recover crashed processes
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
│   └── init-prompt-md.md
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
- **Monetization** - Subscription (target $5-10/month)
- **Auth** - OAuth browser login (Google/GitHub), no trial mode
- **Global storage** - All Trinity data in `~/.trinity/`, user projects stay clean (only CLAUDE.md added)
- **Parallel workspaces** - Each feature gets isolated repo clone, multiple PRDs, run simultaneously

## Questions Remaining

1. How do we handle different project types?
   - AI figures it out from project structure via smart init
   - Example implementations for reference

2. Pricing model?
   - Free tier with limits?
   - One-time purchase?
   - Subscription?

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
