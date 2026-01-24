# Trinity Documentation

Trinity is a CLI tool for running autonomous AI development loops. Point it at a project, define stories, let it build while you're AFK.

## Quick Start

```bash
trinity init                    # Initialize project
trinity analyze                 # Understand codebase
trinity plan add                 # Define what to build
trinity run                     # Let it build
```

**Flow:** `analyze → plan add → run`

---

## Documentation Index

### Reference

| Document | Description |
|----------|-------------|
| [COMMANDS.md](./COMMANDS.md) | Complete CLI command reference with all flags |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture, database schema, storage |
| [PRD.md](./PRD.md) | Writing effective PRDs, story format, dependencies |
| [PROMPTS.md](./PROMPTS.md) | Prompt system, templates, customization |
| [WORKFLOWS.md](./WORKFLOWS.md) | Common workflows and usage examples |
| [ROADMAP.md](./ROADMAP.md) | Version roadmap, decisions, open questions |

---

## Key Concepts

### PRD Hierarchy

```
Phase → Epic → Story
```

- **Phase**: Major milestone ("MVP", "Growth")
- **Epic**: Complete feature ("Auth", "Payments")
- **Story**: Single implementable task ("Add login form")

### Dependency Syntax

```
"mvp"                        → whole phase
"mvp:auth"                   → epic in phase
"mvp:auth:STORY-1.1.2"       → specific story
```

### Autonomous Loop

1. Query next story (deps met)
2. Create feature branch
3. Claude Code implements
4. Self-review and iterate
5. Human testing if required
6. PR and merge
7. Repeat

---

## What to Read

**Getting started?** → [COMMANDS.md](./COMMANDS.md)

**Building Trinity?** → [ARCHITECTURE.md](./ARCHITECTURE.md)

**Writing stories?** → [PRD.md](./PRD.md)

**Customizing prompts?** → [PROMPTS.md](./PROMPTS.md)

**Examples?** → [WORKFLOWS.md](./WORKFLOWS.md)
