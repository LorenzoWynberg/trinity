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
├── gui/                 # Wails desktop app (v0.5)
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
├── auth.json                         # OAuth tokens (v0.2+)
├── config.json                       # Global preferences
├── sessions/                         # Wizard progress, temp data
│   └── <id>.json
├── projects/
│   └── <project-hash>/               # Hash = slugify(name)-timestamp
│       ├── config.json               # Project config (includes db.provider)
│       └── trinity.db                # SQLite: PRD, agents, activity, learnings, queue (solo mode)
```

**User's project:** Only gets optional CLAUDE.md. All other state in `~/.trinity/`.

### Database Providers (v0.3+)

| Mode | Provider | Use Case |
|------|----------|----------|
| Solo (default) | SQLite | Local development, single developer |
| Managed | Turso | Teams, we provision, included in subscription |
| BYOD Turso | Turso | Teams, user provides their own API key |
| BYOD DB | Postgres/MySQL | Enterprise, self-hosted, compliance requirements |

Configuration:
```bash
trinity config set db.provider managed|turso|postgres|mysql
trinity config set db.connection <connection-string-or-api-key>
```

Solo mode uses SQLite in `~/.trinity/projects/<hash>/trinity.db`. Team modes connect to remote database - no local trinity.db file.

### Git Worktrees

Trinity uses git worktrees for parallel agent execution instead of full clones:

```bash
# How Trinity manages workspaces
git worktree add ~/.trinity/projects/<hash>/worktrees/feature-auth feature/auth
git worktree add ~/.trinity/projects/<hash>/worktrees/feature-payments feature/payments
```

**Why worktrees:**
- **Lightweight** - Share `.git` directory, only checkout working files
- **Fast** - Creating a worktree is instant (no clone needed)
- **Parallel** - Multiple agents work in different worktrees simultaneously
- **Independent** - Each worktree has its own branch, index, and working tree

**How it works:**
1. Agent starts work on `mvp:auth` epic
2. Trinity creates worktree: `git worktree add worktrees/feature-auth -b feature/auth`
3. Agent works in that worktree directory
4. When done, PR merges to `dev`, worktree removed: `git worktree remove feature-auth`

**Multiple agents running in parallel:**
```
worktrees/
├── feature-auth/          # Agent 1 working here
├── feature-payments/      # Agent 2 working here (no deps on auth)
└── feature-notifications/ # Agent 3 working here
```

Each worktree is a complete working directory with its own branch. Agents don't interfere with each other.

---

## Database Layer

All state lives in the database. Trinity provides a typed Go API with an adapter layer supporting multiple backends (SQLite for solo, Turso/Postgres/MySQL for teams).

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

-- Command Queue (for internal commands from Claude)
queue (id, type, payload, status, agent_id, created_at, processed_at)
-- type: 'complete', 'learn', 'add-story', 'log', 'move-story'
-- status: 'pending', 'processing', 'done', 'failed'

-- Token Usage (cost tracking)
token_usage (id, story_id, timestamp, input_tokens, output_tokens, model)
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

## Claude Code Integration

Trinity shells out to the `claude` CLI as its execution engine.

### Invocation Pattern

Based on the ralph.elv reference implementation:

```bash
# Basic invocation (non-streaming)
claude --dangerously-skip-permissions --print < prompt.md

# Streaming with JSON output
claude --dangerously-skip-permissions --verbose --print --output-format stream-json < prompt.md
```

**Flags:**
- `--dangerously-skip-permissions` - Allows Claude to run without interactive permission prompts
- `--print` - Output response to stdout
- `--output-format stream-json` - Stream JSON events for real-time progress

### Signal System

Claude communicates back to Trinity via structured signals in output:

```
<story-complete>STORY-1.2.3</story-complete>    # Story finished
<story-blocked>Reason here</story-blocked>      # Can't proceed
<promise>COMPLETE</promise>                     # Confirm action taken
```

Trinity parses these signals to update state and decide next actions.

### Prompt Flow

1. Trinity fills prompt template with context (story, learnings, code)
2. Pipes prompt to Claude via stdin
3. Claude executes, outputs results + signals
4. Trinity parses output, updates DB, continues loop

```go
// Simplified invocation
cmd := exec.Command("claude", "--dangerously-skip-permissions", "--print")
cmd.Stdin = promptReader
cmd.Dir = worktreePath
output, err := cmd.Output()
// Parse output for signals, update state
```

---

## Reliability & Recovery

### Dependency Checks

Before any operation, Trinity validates the environment:

```go
// core/claude/checks.go
func ValidateEnvironment() error {
    // 1. Claude CLI installed and accessible
    if _, err := exec.LookPath("claude"); err != nil {
        return errors.New("claude CLI not found - install from https://claude.ai/code")
    }

    // 2. Claude CLI responds (not broken install)
    cmd := exec.Command("claude", "--version")
    if err := cmd.Run(); err != nil {
        return errors.New("claude CLI not working")
    }

    // 3. Git available
    if _, err := exec.LookPath("git"); err != nil {
        return errors.New("git not found")
    }

    return nil
}
```

### Git State Validation

Before `trinity run`, validate git state:

```go
// core/git/validate.go
func ValidateRepoState(repoPath string) error {
    // 1. Is a git repo
    // 2. Working tree clean (no uncommitted changes)
    // 3. On expected branch (dev or feature branch)
    // 4. No merge conflicts
    // 5. Remote is reachable (warning only)
}
```

If dirty, Trinity prompts: stash, commit, or abort.

### Crash Recovery

Trinity persists state to DB before each phase. On restart, it resumes:

```sql
-- Story state tracking
stories.status = 'in_progress'     -- Was working on this
agents.current_story = 'STORY-1.2.3'
agents.started_at = timestamp
```

Recovery flow:
1. `trinity run` checks for in-progress stories
2. If found, checks if agent process still running (PID check)
3. If stale (crashed), resets story to `pending` or resumes from last checkpoint
4. Prompts user: resume, restart story, or skip

### Timeout Handling

Configurable timeout prevents hung Claude sessions:

```go
// Default: 30 minutes per story
ctx, cancel := context.WithTimeout(context.Background(), cfg.StoryTimeout)
defer cancel()

cmd := exec.CommandContext(ctx, "claude", ...)
```

Configuration:
```bash
trinity config set story_timeout 30m    # Default
trinity config set story_timeout 1h     # Long stories
```

On timeout:
1. Kill Claude process
2. Log partial output
3. Mark story as `pending` with error note
4. Continue to next story or pause (configurable)

### Token Tracking

Track Claude usage for cost visibility:

```sql
-- New table
token_usage (
    id INTEGER PRIMARY KEY,
    story_id TEXT,
    timestamp DATETIME,
    input_tokens INTEGER,
    output_tokens INTEGER,
    model TEXT
)
```

Parsed from Claude's output (when using `--output-format stream-json`).

```bash
trinity status --cost           # Show token usage summary
trinity status --cost --today   # Today's usage
```

---

## Skill Management

Trinity manages Claude Code skills to enhance AI capabilities based on project needs.

### Auto-Install on Init

`trinity init` detects stack and installs relevant skills globally:

| Detected Stack | Skills Installed |
|----------------|------------------|
| Go | `golang-pro` |
| Go + CLI | `golang-pro`, `cli-developer` |
| React/Next.js | `react-expert`, `nextjs-developer` |
| Python + FastAPI | `python-pro`, `fastapi-expert` |
| TypeScript | `typescript-expert` |
| Microservices | `microservices-architect` |

### Suggest Missing Skills

`trinity analyze` and `trinity skills suggest` detect patterns that would benefit from additional skills:

```
Detected patterns:
  • gRPC service definitions → microservices-architect
  • OpenAPI/Swagger specs → api-designer
  • Kubernetes manifests → kubernetes-specialist
  • CI/CD pipelines → devops-engineer
```

### Installation

```bash
# Trinity wraps the add-skill CLI
trinity skills add golang-pro cli-developer

# Under the hood:
npx add-skill Jeffallan/claude-skills --skill <name> -a claude-code -g -y
```

Skills installed to `~/.agents/skills/` (global) - available across all projects.

Use `trinity init --skip-skills` to disable auto-install.

---

## Technical Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| CLI | Go | Fast, single binary, good CLI ecosystem |
| GUI (v0.5) | Wails | Go-based, auto TS bindings, lighter than Electron |
| Database (solo) | SQLite | Embedded, single file, no setup |
| Database (teams) | Turso / Postgres / MySQL | Managed or BYOD, adapter layer in core/db |
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
