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

**Init & Run:**
```bash
trinity init                    # Smart init with Claude (analyzes project)
trinity run                     # Run loop (foreground, streaming output)
trinity run --bg                # Run in background
trinity run --once              # Single story only
trinity watch                   # Attach to running loop, stream output
trinity finish                  # Complete current story, then exit gracefully
trinity kill                    # Hard stop immediately
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
trinity reset --hard            # Remove .trinity/ entirely
trinity config show             # Show configuration
trinity config set KEY VALUE    # Set config value
trinity config edit             # Open config in editor
```

**Logging:**
- All runs logged to `.trinity/logs/YYYY-MM-DD-NNN.log`
- `latest` symlink points to current/most recent log
- Background runs write to log instead of terminal

#### Smart Init
Instead of static templates, `trinity init` uses Claude to understand the project:

1. Run `init-analyze.md` prompt → get project summary (stack, build cmd, structure)
2. Run `init-claude-md.md` prompt → generate CLAUDE.md if missing
3. Run `init-prompt-md.md` prompt → generate tailored prompt.md
4. Create starter `prd.json` (empty, ready for stories)

**Meta-prompts** (ship with Trinity):
- `prompts/init-analyze.md` - Analyze project structure
- `prompts/init-claude-md.md` - Generate CLAUDE.md
- `prompts/init-prompt-md.md` - Generate Trinity prompt.md

#### Requirements
- **Claude Code** - Required. Trinity uses Claude Code as its execution engine (not just an LLM API). Claude Code handles file I/O, bash commands, tool loops, context management.

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
