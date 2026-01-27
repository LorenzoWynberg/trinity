# PRD Structure

How Ralph's PRD files are organized and what each field means.

## File Organization

PRDs are stored in `tools/ralph/cli/prd/` as versioned JSON files:

```
prd/
├── v0.1.json   # MVP - Foundation, database, core loop
├── v1.0.json   # Release - Auth, polish, testing
└── v2.0.json   # Future - Teams, advanced features
```

Each version is a complete PRD with its own phases, epics, and stories. Ralph can target a specific version with `--target-version v1.0`.

## Top-Level Structure

```json
{
  "title": "Trinity MVP",
  "shortTitle": "MVP",
  "description": "Core CLI infrastructure...",
  "phases": [...],
  "epics": [...],
  "stories": [...]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Full version name (displayed in headers) |
| `shortTitle` | string | Short name for status displays |
| `description` | string | What this version covers |
| `phases` | array | Milestone definitions |
| `epics` | array | Feature group definitions |
| `stories` | array | All stories for this version |

## Phases and Epics

Phases and epics are defined separately (not nested):

```json
"phases": [
  { "id": 1, "name": "Foundation" },
  { "id": 2, "name": "Database Layer" }
],
"epics": [
  { "phase": 1, "id": 1, "name": "Project Setup" },
  { "phase": 1, "id": 2, "name": "Configuration" },
  { "phase": 2, "id": 1, "name": "PRD Tables" }
]
```

- **Phase IDs** are unique within a version (1, 2, 3...)
- **Epic IDs** are unique within their phase (phase 1 can have epic 1, phase 2 can also have epic 1)

## Story Schema

### Required Fields

```json
{
  "id": "1.2.3",
  "title": "Create user model",
  "intent": "Store user credentials and profile",
  "acceptance": [
    "User table with email, password_hash",
    "Unique constraint on email"
  ],
  "passes": false,
  "phase": 1,
  "epic": 2,
  "story_number": 3,
  "target_version": "v0.1"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Story ID in `phase.epic.story` format |
| `title` | string | Imperative action ("Add X", "Implement Y") |
| `intent` | string | Why this matters (business value) |
| `acceptance` | array | Testable criteria for completion |
| `passes` | boolean | Claude completed the work |
| `phase` | number | Parent phase ID |
| `epic` | number | Parent epic ID |
| `story_number` | number | Story number within epic |
| `target_version` | string | Which version this belongs to |

### Optional Fields

```json
{
  "description": "Implementation context...",
  "depends_on": ["1.1.1", "v0.1:1.2.3"],
  "tags": ["api", "auth"],
  "merged": true,
  "branch": "feat/v0.1/story-1.2.3",
  "merge_commit": "abc123",
  "pr_url": "https://github.com/...",
  "human_testing": {
    "required": true,
    "instructions": "Test login flow",
    "url": "/login"
  },
  "external_deps": [
    {
      "name": "License API",
      "description": "API endpoint for validating license keys"
    }
  ],
  "external_deps_report": "API is at https://api.example.com/validate..."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Implementation context, patterns, constraints |
| `depends_on` | array | Story/phase/epic dependencies (see below) |
| `tags` | array | Categorization tags for filtering |
| `merged` | boolean | PR merged to base branch |
| `branch` | string | Feature branch name |
| `merge_commit` | string | Git SHA of merge commit |
| `pr_url` | string | Link to pull request |
| `human_testing` | object | Manual testing gate (see below) |
| `external_deps` | array | External dependencies to implement |
| `external_deps_report` | string | User-provided context about external deps |

## Story ID Format

Ralph uses numeric dot-notation: `phase.epic.story`

```
1.2.3  →  Phase 1, Epic 2, Story 3
```

**Both formats work:** Ralph accepts both `1.2.3` and `STORY-1.2.3`. The code normalizes input internally via `normalize-story-id`, so these are equivalent:

```bash
./ralph.elv --story 1.2.3
./ralph.elv --story STORY-1.2.3
```

PRD files store IDs in the short `1.2.3` format. The `STORY-` prefix is added when needed for display or external references.

## Dependency Syntax

Dependencies can reference stories, epics, phases, or cross-version items:

```json
"depends_on": [
  "1.1.1",           // Story in same version
  "1.2",             // All stories in epic 1.2 (phase 1, epic 2)
  "1",               // All stories in phase 1
  "v0.1",            // All stories in v0.1
  "v0.1:1.2.3",      // Specific story in v0.1
  "v0.1:1.2",        // Epic in v0.1
  "v0.1:1"           // Phase in v0.1
]
```

**Resolution rules:**
- Dependencies check `merged: true`, not just `passes: true`
- A phase/epic dependency is met when ALL its stories are merged
- Cross-version dependencies allow sequencing work across releases

## Two-Stage Completion

Stories track completion in two stages:

1. **`passes: true`** - Claude completed the work and pushed to feature branch
2. **`merged: true`** - PR merged to integration branch (dev)

**Why two stages?**
- Dependencies check `merged`, not `passes` - prevents starting work before code is available
- Allows "completed but not merged" states (waiting for review, CI)
- `merge_commit` and `pr_url` provide audit trail

## Human Testing Gates

For stories requiring manual verification:

```json
"human_testing": {
  "required": true,
  "instructions": "Test login with valid/invalid credentials",
  "url": "/login"
}
```

When `required: true`, Ralph pauses after Claude completes the work and prompts for approval:
- **approve** - Proceed with PR and merge
- **reject** - Provide feedback, Claude iterates

## External Dependencies

For stories that depend on external systems/APIs:

```json
"external_deps": [
  {
    "name": "License API",
    "description": "API endpoint for validating license keys"
  }
],
"external_deps_report": null
```

Before executing a story with `external_deps`, Ralph prompts for a report explaining:
- Actual endpoints/URLs
- Response schemas
- API keys location
- Any other implementation context

The report is stored in `external_deps_report` and injected into Claude's prompt.

## State File

Ralph tracks runtime state in `state.json`:

```json
{
  "version": 1,
  "current_story": "1.2.3",
  "status": "running",
  "error": null,
  "started_at": "2024-01-15T10:30:00Z",
  "branch": "feat/v0.1/story-1.2.3",
  "attempts": 1,
  "pr_url": "https://github.com/...",
  "last_updated": "2024-01-15T10:35:00Z",
  "checkpoints": []
}
```

| Field | Type | Description |
|-------|------|-------------|
| `version` | number | State schema version (currently 1) |
| `current_story` | string/null | Story being worked on |
| `status` | string | `idle`, `running`, `blocked`, `error` |
| `error` | string/null | Last error message |
| `started_at` | string/null | When current story started |
| `branch` | string/null | Current feature branch |
| `attempts` | number | Retry count for current story |
| `pr_url` | string/null | PR URL if created |
| `last_updated` | string/null | Last state change timestamp |
| `checkpoints` | array | Completed workflow checkpoints for resume (see below) |

### Checkpoint Structure

Each checkpoint in the array has:

```json
{
  "story_id": "1.2.3",
  "stage": "claude_complete",
  "at": "2026-01-27T15:30:00Z",
  "attempt": 2,
  "data": {
    "signal": "complete",
    "commit": "abc123"
  }
}
```

Stages: `branch_created`, `validation_complete`, `claude_started`, `claude_complete`, `pr_created`

This enables `--resume` to skip completed phases instead of restarting from scratch. See CLI Reference for details.

## Example: Complete Story

```json
{
  "id": "1.1.2",
  "title": "Implement license key validation",
  "intent": "Validate license key against auth API before running operations",
  "description": "The validation flow: Auth.Validate(key) makes a POST to the license API...",
  "acceptance": [
    "Validate(key) calls auth API endpoint",
    "Returns LicenseInfo struct with valid, tier, expires_at",
    "Handles network errors gracefully",
    "Caches successful validation for 24 hours"
  ],
  "passes": true,
  "merged": true,
  "branch": "feat/v1.0/story-1.1.2",
  "merge_commit": "abc123def",
  "pr_url": "https://github.com/trinity-ai-labs/trinity/pull/42",
  "depends_on": ["1.1.1"],
  "phase": 1,
  "epic": 1,
  "story_number": 2,
  "target_version": "v1.0",
  "external_deps": [
    {
      "name": "License API",
      "description": "API endpoint for validating license keys"
    }
  ],
  "external_deps_report": "API endpoint: POST https://api.trinity.dev/v1/licenses/validate\nRequest: {key: string}\nResponse: {valid: bool, tier: string, expires_at: timestamp}",
  "tags": ["api", "auth", "validation"]
}
```
