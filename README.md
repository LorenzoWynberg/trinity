# Trinity

> Autonomous AI development loops for any project.

## What is this?

Trinity sets up and runs AI-powered autonomous development workflows. Point it at a project, define your stories, and let it build while you're AFK.

**Status:** Planning phase - see [docs/plans/INITIAL_PLAN.md](docs/plans/INITIAL_PLAN.md)

## Planned Features

- 🚀 **CLI** - `trinity init`, `trinity run`, `trinity status`
- 🧠 **Smart Init** - Claude analyzes your project and generates setup
- 📊 **Streaming** - Real-time output as AI works
- 🖥️ **GUI** - Desktop app for visual workflow management (v0.5)

## Requirements

- [Claude Code](https://claude.ai/code) - Trinity uses Claude Code as its execution engine

## Quick Start (Future)

```bash
# Install
go install github.com/LorenzoWynberg/trinity@latest

# Initialize in your project
cd my-project
trinity init

# Add stories to .trinity/prd.json, then:
trinity run
```

## License

Commercial
