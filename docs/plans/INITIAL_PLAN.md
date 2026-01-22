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

#### CLI
- `trinity init` - Initialize Trinity in current project (interactive setup)
- `trinity run` - Run the development loop
- `trinity status` - Show current state/progress
- `trinity reset` - Reset state
- `trinity config` - Manage configuration

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

#### Desktop App (Tauri)
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

```
trinity/
├── packages/
│   ├── cli/           # CLI tool (Rust)
│   ├── core/          # Core logic (shared)
│   ├── gui/           # Desktop app (Tauri)
│   └── prompts/       # Meta-prompts for smart init
├── docs/
│   ├── plans/
│   └── guides/
└── examples/
```

## Technical Stack

### CLI
- **Rust** - Fast execution, single binary, cross-platform

### GUI Framework (v0.2)
- **Tauri** - Pairs well with Rust CLI, lighter than Electron

### AI Integration
- **Claude Code CLI only** - Shell out to `claude` command
- No API fallback needed - Claude Code IS the execution engine

## Decisions Made

- **Name:** Trinity
- **Claude Code required** - It's the execution engine, not a swappable provider
- **Commercial** - Closed source commercial product
- **CLI in Rust** - Fast, single binary distribution
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

1. [ ] Decide on CLI language → **Rust**
2. [ ] Create basic CLI scaffold
3. [ ] Port loop logic from jetbrains-elvish Ralph
4. [ ] Create meta-prompts for smart init
5. [ ] Test on a new project
6. [ ] Iterate based on feedback

## Inspiration

- Claude Code - AI coding assistant
- Cursor - AI-first code editor
- Devin - Autonomous AI developer
- GPT Engineer - AI code generation
- Aider - AI pair programming
