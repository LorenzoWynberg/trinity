# Workflows

Common Trinity workflows and usage examples.

## Basic Flow

The core Trinity flow:

```bash
trinity init                    # 1. Initialize
trinity analyze                 # 2. Understand codebase
trinity prd add                 # 3. Define what to build
trinity run                     # 4. Let it build
```

---

## Starting a New Project

### 1. Initialize

```bash
cd my-project
trinity init
```

Trinity will:
- Analyze your project structure
- Detect stack (language, framework)
- Create CLAUDE.md with project context
- Set up `~/.trinity/projects/<hash>/`

### 2. Analyze

```bash
trinity analyze
```

Output:
```
Stack: Go with Chi router
Structure: Clean architecture (handlers/, services/, models/)
Tests: 47% coverage, mainly unit tests

Suggestions:
- Add authentication (no auth currently)
- Add rate limiting to API endpoints
- Increase test coverage for services/
```

### 3. Create PRD

```bash
trinity prd add
```

Interactive wizard:
```
Trinity: What are you building?
> User authentication with JWT

Trinity: Generated:
  Phase: MVP
  ├── Epic: Auth (4 stories)

  [I]mplement  [R]efine  [S]how  [O]ver
> i
```

### 4. Run

```bash
trinity run
```

Trinity handles:
- Creating feature branch
- Implementing each story
- Running tests
- Creating PR
- Merging to dev

---

## Adding Features to Existing Project

### Check Current State

```bash
trinity prd show
```

```
MVP
├── Auth ✓ (4/4 complete)
├── Tasks (0/5 complete)
│   ├── STORY-1.2.1 Create task model [pending]
│   ├── STORY-1.2.2 Add task endpoints [pending]
│   └── ...
```

### Add New Feature

```bash
trinity prd add
> Add email notifications when task is assigned
```

Trinity suggests placement:
```
Trinity: Looks like a new epic in MVP.
  [1] New epic: Notifications
  [2] Add to existing epic
  [3] Specify manually...
> 1
```

### Run New Work

```bash
trinity run mvp:notifications
```

---

## Parallel Development

### Run Everything

```bash
trinity run --all
```

Runs all unblocked work in parallel:
```
Starting parallel execution...
[tasks]         STORY-1.2.1 Creating task model...
[notifications] STORY-1.3.1 Setting up email service...
```

### Check Status

```bash
trinity status
```

```
Agents:
  agent-1: mvp:tasks:STORY-1.2.1 (running 5m)
  agent-2: mvp:notifications:STORY-1.3.1 (running 3m)

Progress:
  MVP: 4/13 complete (30%)

Blocked:
  mvp:tasks:STORY-1.2.3 (waiting on STORY-1.2.2)
```

---

## Handling Dependencies

### Story Blocked by Dependency

```bash
trinity run mvp:payments:STORY-2.1.1
```

```
⚠ Cannot run mvp:payments:STORY-2.1.1
  Unmet dependencies:
    - mvp:auth:STORY-1.1.2 (pending)

  Use --with-deps to run dependencies first.
```

### Run with Dependencies

```bash
trinity run mvp:payments:STORY-2.1.1 --with-deps
```

```
Running dependencies first:
  → mvp:auth:STORY-1.1.2 ... ✓ merged to dev
Then running:
  → mvp:payments:STORY-2.1.1 ...
```

### Dependency In Progress

```bash
trinity run mvp:payments:STORY-2.1.1 --with-deps
```

```
⚠ Cannot proceed
  Dependency in progress by another agent:
    - mvp:auth:STORY-1.1.2 (agent-2, started 5m ago)

  Marked as blocked. Will auto-resume when dependency completes.
```

---

## Human Testing

### Story Requires Testing

When a story has `human_testing.required: true`:

```
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
```

### Approve

```bash
trinity approve
```

Story marked complete, loop continues.

### Reject with Feedback

```bash
trinity reject "Password validation not working - accepts 3 char passwords"
```

Claude iterates on implementation, then prompts for testing again.

---

## Quick Fixes (Hotfix)

For quick fixes outside the PRD flow:

```bash
trinity hotfix "login button broken on mobile"
```

```
Trinity: Analyzing...

  Found issue in src/components/LoginButton.tsx
  - onClick missing touch event

  [V]iew diff  [A]pply  [R]efine  [C]ancel
> a

Trinity: Applied fix, tests passing.

  [P]R to dev  [M]ain (urgent)  [C]ommit only
> p

Trinity: Created PR #42 → dev
```

### Urgent Hotfix to Main

```bash
trinity hotfix "critical security fix" --target main --auto-merge
```

---

## Releasing

### Preview Release

```bash
trinity release --dry-run
```

```
Would merge dev → main:
  - 12 commits
  - 45 files changed
  - Features: auth, tasks, notifications
```

### Release with Tag

```bash
trinity release --tag v1.0.0
```

```
Merged dev → main
Created tag: v1.0.0
```

---

## Configuration

### Set Integration Branch

```bash
trinity config set integration_branch develop
```

### Enable Auto-Merge

```bash
trinity config set auto_merge true
```

### Configure Dev Server

```bash
trinity config set dev_cmd "npm run dev"
trinity config set dev_port 3000
trinity config set dev_ready_signal "ready on"
```

---

## Docker Isolation

### Run in Container

```bash
trinity run --docker
```

### Run All in Containers

```bash
trinity run --all --docker
```

Benefits:
- Filesystem isolation
- Resource limits
- Network restrictions
- Clean environment

---

## Troubleshooting

### Stuck Agent

```bash
trinity status
```

Shows stale agents. Trinity auto-recovers on next `run`.

### Reset Story

```bash
trinity prd retry mvp:auth:STORY-1.1.2
```

Resets story to pending.

### Skip Story

```bash
trinity prd skip mvp:auth:STORY-1.1.2
```

Skip problematic story, continue with others.

### Hard Reset

```bash
trinity config reset
```

Resets to defaults. Project data preserved.
