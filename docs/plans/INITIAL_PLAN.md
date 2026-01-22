# Ralph Framework - Initial Plan

## Vision

A framework/tool for creating and running autonomous AI development loops (like Ralph) for any project. Think "Ralph-as-a-service" with multi-provider support and a user-friendly interface.

## Core Concepts

### What is Ralph?
Ralph is an autonomous development loop that:
1. Reads a PRD (Product Requirements Document) with stories
2. Picks the next story based on dependencies
3. Creates a feature branch
4. Runs an AI agent (Claude) to implement the story
5. Self-reviews and iterates
6. Creates PR, merges, cleans up
7. Repeats until all stories complete

### What is Ralph Framework?
A tool that:
- **Scaffolds** Ralph-style setups for any project
- **Manages** multiple project configurations
- **Supports** multiple AI providers
- **Provides** CLI and GUI interfaces
- **Tracks** progress across projects

## Features

### MVP (v0.1)

#### CLI
- `ralph init` - Initialize Ralph in current project (interactive setup)
- `ralph run` - Run the development loop
- `ralph status` - Show current state/progress
- `ralph reset` - Reset state
- `ralph config` - Manage configuration

#### Templates
- **Generic** - Basic PRD + prompt template
- **JetBrains Plugin** - Gradle/Kotlin focused (from jetbrains-elvish)
- **Node.js** - npm/TypeScript focused
- **Python** - pip/pytest focused

#### AI Provider Support
- Claude (via Claude Code CLI) - primary
- OpenAI (via API) - planned
- Gemini (via API) - planned
- Local models (Ollama) - future

### v0.2 - GUI

#### Desktop App (Electron/Tauri?)
- Project management dashboard
- Visual PRD editor (drag-drop stories, dependencies)
- Real-time streaming output (like we just built)
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
ralph-framework/
├── packages/
│   ├── cli/           # CLI tool (Node.js or Rust?)
│   ├── core/          # Core logic (shared)
│   ├── gui/           # Desktop app
│   └── templates/     # Project templates
├── docs/
│   ├── plans/
│   └── guides/
└── examples/
```

## Technical Decisions to Make

### Language for CLI
- **Node.js/TypeScript** - Fast to build, good ecosystem
- **Rust** - Fast execution, single binary, but slower to develop
- **Go** - Good middle ground
- **Elvish** - Dogfooding, but limited ecosystem

### GUI Framework
- **Electron** - Proven, but heavy
- **Tauri** - Lighter, Rust-based, modern
- **Web app** - Browser-based, no install

### AI Integration
- **Claude Code CLI** - Shell out to `claude` command (current approach)
- **Direct API** - More control, but need to handle streaming, tools, etc.
- **Hybrid** - Use Claude Code when available, fall back to API

## Questions to Answer

1. Who is the target user?
   - Developers who want to automate repetitive coding tasks?
   - Teams wanting autonomous CI/CD-like development?
   - Solo devs wanting an AI pair programmer that runs overnight?

2. What's the relationship with Claude Code?
   - Requires Claude Code installed?
   - Can work standalone with API keys?
   - Both?

3. Open source or commercial?
   - Open source core + paid cloud features?
   - Fully open source?
   - Closed source commercial?

4. How do we handle different project types?
   - Templates are just starting points?
   - Plugins for different ecosystems?
   - AI figures it out from project structure?

## Next Steps

1. [ ] Decide on CLI language
2. [ ] Create basic CLI scaffold
3. [ ] Port Ralph logic from jetbrains-elvish
4. [ ] Create generic template
5. [ ] Test on a new project
6. [ ] Iterate based on feedback

## Name Ideas

- Ralph Framework
- Ralph CLI
- AutoDev
- LoopDev
- AFK Dev (Away From Keyboard Developer)
- Flowbot
- DevLoop

## Inspiration

- Claude Code - AI coding assistant
- Cursor - AI-first code editor
- Devin - Autonomous AI developer
- GPT Engineer - AI code generation
- Aider - AI pair programming
