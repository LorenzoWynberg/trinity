# CLAUDE.md

Instructions for Claude Code when working in this repository.

## Quick Reference

```bash
./gradlew build        # Build and test
./gradlew runIde       # Run sandbox IDE
```

## Follow CONTRIBUTING.md

**Use [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for:**
- Branching strategy
- Commit message format
- PR process
- Code style

**Key rule:** No "Co-Authored-By" lines (commits or PRs)

## Task Workflow

### When to Use Full Workflow

**Use `--ralph-style`** (or "ralph style", "full workflow") when you want the complete workflow below.

**Skip the workflow** for:
- Quick questions or lookups
- When Ralph is running Claude (Ralph handles the workflow)
- Simple one-off tasks

---

### Full Workflow (when `--ralph-style` requested)

### 1. Load Context
Before starting ANY task, read relevant files:
- `docs/learnings/` - Check topic files based on task:
  - `elvish.md` - Elvish language patterns
  - `intellij-plugin.md` - Core plugin patterns
  - `lsp.md` - LSP integration
  - `editor.md` - Editor features
  - `run-configs.md` - Run configurations
  - `templates.md` - File/live templates
  - `testing.md` - Testing patterns
  - `build.md` - Build/environment
- Recent activity logs in `docs/activity/` for context

### 2. Activity Log
Create or update `docs/activity/YYYY-MM-DD.md`:
- Add entry when starting the task
- Document decisions made
- Update when task completes
- Before archiving old logs: extract learnings to `docs/learnings/`
- Archive logs older than 7 days to `docs/activity/archive/YYYY-MM/`

### 3. Scope
Work on ONE task at a time. Stay focused:
- Don't refactor unrelated code
- Note other issues in learnings for later

### 4. Implementation
- Write code
- Write tests when applicable (skip for pure UI, trivial code, or LSP integration)
- Tests go in `src/test/kotlin/` mirroring main structure

### 5. Verification
```bash
./gradlew build  # Must pass
```

### 6. Self-Review
After build passes, ask: "What's missing or could improve?"
- Edge cases, API design, code organization
- Only implement if in scope and meaningful
- Max 3 review cycles

### 7. Update Learnings
After completing the task:
- **Add** new patterns to appropriate `docs/learnings/*.md` file
- **Correct** anything discovered to be wrong
- **Remove** outdated info
- Note corrections in activity log

### 8. Documentation
Update docs if changes affect:
- README.md - New features, requirements
- docs/DEVELOPMENT.md - Architecture, new components
- docs/CONTRIBUTING.md - Workflow changes

### 9. Commit & Push
Follow [CONTRIBUTING.md](docs/CONTRIBUTING.md) for commit format and branching.

## Project Overview

JetBrains plugin for Elvish shell language support. Uses Elvish's built-in LSP (`elvish -lsp`) for completions, diagnostics, hover, and go-to-definition.

## Key Files

| Path | Purpose |
|------|---------|
| `src/main/kotlin/com/elvish/plugin/` | Plugin source code |
| `src/main/resources/META-INF/plugin.xml` | Plugin manifest |
| `src/main/resources/textmate/` | TextMate grammar |
| `docs/learnings/` | Consolidated patterns and gotchas |
| `docs/activity/` | Daily activity logs |

## Documentation

- [Quick Context](docs/CONTEXT.md) - Fast reference (start here for quick tasks)
- [Contributing Guide](docs/CONTRIBUTING.md) - Full workflow, branching, commits
- [Development Guide](docs/DEVELOPMENT.md) - Build, architecture, debugging
- [Roadmap](docs/ROADMAP.md) - Future plans
- [Changelog](docs/CHANGELOG.md) - Version history
- [Learnings](docs/learnings/) - Topic-based patterns
