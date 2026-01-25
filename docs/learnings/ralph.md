# Ralph Learnings

> **TL;DR:** Two-stage completion (passes→merged), blocked state detection with dependency info, activity logs split by project (trinity/ for Ralph's work, ralph/ for human docs), release workflow with human gate and hotfix loop, PR defaults (yes create, no merge), validation flow with clarify/auto-proceed options, external deps flow with report requirement.

## Streaming Claude Output

### jq filters for stream-json
From [aihero.dev](https://www.aihero.dev/heres-how-to-stream-claude-code-with-afk-ralph):

```bash
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
final_result='select(.type == "result").result // empty'

claude --output-format stream-json < prompt.md 2>&1 | \
  grep --line-buffered '^{' | \
  tee output.json | \
  jq --unbuffered -rj "$stream_text"
```

Key flags:
- `--line-buffered` on grep for real-time output
- `--unbuffered` on jq for streaming
- `-rj` on jq: raw output, join without newlines

## State Management

### Blocked State Detection

When no runnable stories exist, Ralph distinguishes between:
- **All complete** - every story merged, ready for release
- **Blocked** - stories exist but dependencies aren't met

Blocked state shows detailed info:
```
╔════════════════════════════════════════════════════════╗
║  BLOCKED - WAITING ON DEPENDENCIES
╚════════════════════════════════════════════════════════╝

Unmerged PRs:
  • STORY-1.1.1 (Create Go workspace): https://github.com/...

Pending stories blocked by unmerged work:
  • STORY-1.1.2 (Create CLI entrypoint) → waiting on STORY-1.1.1

Run ralph to pick up where you left off.
```

Also distinguishes "passed but no PR yet" (user said no to PR creation) from "PR exists but not merged".

### Three-Stage Completion
Metrics track three distinct stages:
- `stories_passed` - Claude completed the work and pushed
- `stories_prd` - PR created on GitHub
- `stories_merged` - PR merged to base branch

PRD state tracks two flags per story:
- `passes: true` - Claude completed the work
- `merged: true` - PR merged to base branch

**Why this matters:**
- Dependencies check `merged`, not `passes`
- Prevents next story from starting before code is in dev
- Allows identifying "passed but no PR" vs "PR open but not merged" scenarios
- Metrics give visibility into the full pipeline

## Story Validation

### Validation prompt
Before executing a story, Claude validates the acceptance criteria for ambiguity:
```
Story needs clarification:
- What Go version should be used?
- What module path format?

[Y]es skip / [n]o stop / [c]larify / [a]uto-proceed
```

Options:
- `[Y]` - Skip this story, try the next one (default)
- `[n]` - Stop execution entirely
- `[c]` - Open editor to provide clarification answers
- `[a]` - Auto-proceed with reasonable assumptions

### Clarification flow
When user chooses `[c]larify`:
1. Editor opens with story questions as comments
2. User types clarification answers below
3. Answers are injected into Claude's prompt as "## User Clarification" section
4. Claude uses this context to resolve ambiguities

### Auto-clarify flag
`--auto-clarify` flag automatically uses auto-proceed mode without prompting. Useful for fully autonomous runs where you trust Claude to make reasonable decisions on ambiguous stories.

### Validation returns
`claude:validate-story` returns a map `[&valid=$bool &questions=$string]` so questions can be passed to the clarification editor if needed.

## External Dependencies

### When stories need external setup
Some stories depend on external systems (auth APIs, third-party services, etc.) that must be set up before Claude can implement them. These are tracked in the `external_deps` field:

```json
{
  "external_deps": [
    {"name": "Auth API", "description": "OAuth endpoints on main website"},
    {"name": "API Keys", "description": "User can generate keys in dashboard"}
  ]
}
```

### External deps prompt
Before executing a story with external deps, Ralph prompts:
```
Story STORY-X.Y.Z has external dependencies:
  • Auth API: OAuth endpoints on main website
  • API Keys: User can generate keys in dashboard

[r]eport / [n]o skip
```

- `[r]` (default) - Open editor to provide implementation report
- `[n]` - Skip story, try next one

### Report flow
When user chooses `[r]eport`:
1. Editor opens with dep names/descriptions as comments
2. User documents how they implemented (endpoints, auth, keys, schemas)
3. Report is injected into Claude's prompt as "## External Dependencies Report"
4. Claude uses this to integrate correctly

### No "yes ready" option
Unlike validation, there's no "proceed without report" option. If a story has external deps, Claude needs to know *how* they were implemented to integrate with them. You either provide the report or skip.

### Report propagation to descendants
When external deps report is provided:
1. Report is saved to PRD (`external_deps_report` field)
2. All descendant stories are found (recursive traversal of dependency tree)
3. Claude analyzes which descendants need their acceptance criteria updated
4. Only relevant stories are updated with concrete details from the report

**Example:**
```
Story 7.2.1 (Auth) gets report: "OAuth with /auth/login, JWT tokens"
  ↓
Descendants found: 7.2.2, 7.2.3, 7.3.1, 8.1.1
  ↓
Claude analyzes: "7.2.2 and 7.3.1 need updating, others unrelated"
  ↓
PRD updated with OAuth-specific acceptance criteria
```

This keeps the PRD as source of truth with decisions baked in.

## PR Flow

### Prompts with defaults
- PR creation: `[Y]es / [n]o / [f]eedback` - defaults to yes
- PR update (after feedback): `[Y]es / [n]o / [f]eedback` - defaults to yes
- Merge: `[y]es merge / [N]o leave open / [f]eedback` - defaults to no (leave for review)
- Stop loop: `[y/N]` with 120s timeout - defaults to continue

All prompts support `[f]eedback` which restarts the Claude loop with user feedback.

### Skipping PR creation
If user says `[n]o` to PR creation, shows acknowledgment:
```
⚠ No PR created. Story STORY-1.1.1 is passed but unmerged.
Dependent stories will remain blocked until PR is created and merged.
Branch: feat/story-1.1.1
```

The merge prompt is skipped (can't merge what doesn't exist). Story stays in "passed but no PR" state, visible in blocked state output.

## Activity Logging

### Daily log format
`logs/activity/YYYY-MM-DD.md` with timestamped entries documenting what was done.

### Including in prompts
Read 2 most recent logs and include via `{{RECENT_ACTIVITY_LOGS}}` placeholder. Gives Claude context about recent work.

## Feedback Loop

### Three checkpoints with feedback
All three checkpoints support `[f]eedback` option that restarts the loop:

1. **Create PR prompt**: `[Y]es / [n]o / [f]eedback`
   - Before PR is created, user can give feedback to refine the work

2. **Update PR prompt**: `[Y]es / [n]o / [f]eedback`
   - After coming back from feedback loop, asks if PR should be updated
   - If `--auto-pr` flag, auto-updates without prompting

3. **Merge prompt**: `[y]es merge / [N]o leave open / [f]eedback`
   - At merge time, user can request more changes

### Feedback restarts the loop
When feedback is given at any checkpoint:
1. User enters feedback text via editor ($EDITOR or vim)
2. Feedback becomes the prompt for Claude (uses dedicated feedback template)
3. Claude runs full cycle: implement changes, build, test, format, self-review
4. Returns to the checkpoint where feedback was given
5. Can give more feedback or proceed

### Prompt templates
- `prompt.md` - Main story execution template
- `prompts/feedback.md` - Feedback template (includes original task context)
- `prompts/partials/workflow.md` - Shared workflow instructions (verification, self-review, learnings, etc.)

### Feedback template structure
```markdown
# Feedback on {{CURRENT_STORY}}

## Original Task
{{ORIGINAL_TASK}}  # Story title + acceptance criteria

## Feedback
> {{FEEDBACK}}    # User's feedback text

{{WORKFLOW}}      # Shared workflow instructions
```

This gives Claude:
1. Context about what the task was
2. What was requested to change
3. Same workflow instructions as normal execution

## PR Description Generation

### Claude-generated PR bodies
Uses `gh pr create` and `gh pr edit` with Claude-generated descriptions.

### All changes included
PR body includes ALL commits and files from base branch to feature branch:
- `git log --oneline base..branch` - all commits
- `git diff --name-status base..branch` - all changed files
- `git diff --stat base..branch` - change statistics

### Merging existing descriptions
When updating a PR, existing body is fetched and passed to Claude with instruction to merge/extend content rather than replace.

## Activity Log Organization

### Separate by project
```
logs/activity/
├── trinity/        # Ralph writes here (Trinity CLI development)
│   ├── YYYY-MM-DD.md
│   └── archive/YYYY-MM/
└── ralph/          # Humans write here (Ralph's own development)
    ├── YYYY-MM-DD.md
    └── archive/YYYY-MM/
```

**Key distinction:** Ralph works ON Trinity, so Ralph writes to `trinity/` logs. The `ralph/` folder is for human documentation about Ralph itself.

**Note:** Currently `trinity/` is empty because Ralph hasn't completed any Trinity CLI stories yet - it's still being built. The `ralph/` folder has logs from human development of Ralph.

### Archive structure
Old logs go to `archive/YYYY-MM/filename.md` subdirectories, not flat in archive folder.

## Release Workflow

### Human gate at completion
When all stories complete, prompt for release approval:
- `[Y]es` - proceed with release
- `[n]o` - cancel
- `[e]dit tag` - change version tag
- `[f]eedback` - run hotfix, then return to prompt

### Tag on main, not dev
Release flow: create PR (dev→main) → merge → checkout main → tag at merge commit → push tag. The tag must be on main, not on dev.

### Hotfix flow
Feedback at release creates a hotfix branch from dev, runs Claude with the feedback, merges back to dev, then returns to release prompt.

## Dashboard

### Terminology
- **Passed** = Claude finished the work (not "completed" - that's ambiguous)
- **Merged** = PR merged to base branch
- Use "passed" in UI to avoid confusion with "completed"

### Blocked stories display
Shows only "first generation" blocked - stories whose blocker is NOT itself blocked:
- 1.1.2 waiting on 1.1.1 (shown - 1.1.1 has no unmet deps)
- 1.1.3 waiting on 1.1.2 (hidden - 1.1.2 is itself blocked)

This shows the immediate next row, not transitive chains.

### Version filtering
- URL param based: `?version=v1.0`
- Server-side filtering via `getPRD(version)`
- Phases are per-version, so "All versions" shows version count instead of phase count

### Dependency format
PRD uses short format `"1.1.1"` not `"STORY-1.1.1"`. Dashboard code handles both.

### Hydration issues
Radix Select + useSearchParams causes hydration mismatch. Wrap in Suspense:
```tsx
export function VersionSelector(props) {
  return (
    <Suspense fallback={<div className="w-[120px] h-8 bg-muted animate-pulse rounded-md" />}>
      <VersionSelectorInner {...props} />
    </Suspense>
  )
}
```

## Story Tags

Stories in the PRD have a `tags` array for categorization and cross-referencing.

### Tag taxonomy

| Category | Tags | Purpose |
|----------|------|---------|
| Domain | `core`, `cli`, `db`, `git`, `claude`, `prompts`, `auth` | Where code lives |
| Feature | `config`, `prd`, `loop`, `validation`, `recovery`, `release`, `skills` | What it does |
| Concern | `api`, `testing`, `ux`, `docs` | Cross-cutting aspects |

### Uses for tags

1. **Duplicate detection** - Before creating a story, find existing stories with overlapping tags
2. **Propagation** - When external deps affect `auth`, find all `auth`-tagged stories
3. **Reverse dependency check** - New `auth` story might need to be depended on by other `auth` stories
4. **Dashboard filtering** - Filter views by tag
5. **Impact analysis** - Find all stories affected by a change

### Auto-assignment

Tags are assigned automatically based on:
- Title patterns (`"claude"` → `claude` tag)
- Acceptance criteria patterns (`"core/"` → `core` tag)
- Phase/epic location (Phase 7 → `auth` tag)

### Duplicate detection

Before creating a new story during propagation, Ralph checks for duplicates:

1. Find stories with ≥1 tag overlap
2. Ask Claude to check semantic similarity (60% threshold)
3. If match found, prompt user:
```
Potential duplicate found:
  Existing: 7.1.3: Implement offline validation [auth, validation]
  Proposed: Token expiration handling
  Reason:   Both handle token expiry...

[u]pdate existing / [c]reate new anyway / [s]kip
```

**Flag:** `--auto-handle-duplicates` - Auto-update existing instead of prompting

**Why this matters:** Prevents PRD bloat from near-duplicate stories created during propagation.

## CLI Defaults

### Notifications
Desktop notifications are **enabled by default** (helpful for AFK mode). Use `--no-notifs` to disable.

### Reverse dependency check

After creating a new story, Ralph checks if existing stories should depend on it:

1. Find stories with ≥1 tag overlap (excluding earlier phases)
2. Filter out: own deps, already dependents, would-create-cycle
3. Ask Claude which candidates logically need the new story
4. Prompt: `[y]es add all / [n]o skip / [r]eview individually`

**Safety rules:**
- Backwards phase deps rejected (Phase 6 can't depend on Phase 7)
- Cycle check before each add

**Flag:** `--auto-add-reverse-deps` - Auto-add all suggestions

### Tag-based propagation (smarter expansion)

External deps propagation always runs two phases:

**Two-phase analysis:**
- **Phase A:** Descendants - direct dependency tree, high confidence
- **Phase B:** Related by tags - not in tree, conservative analysis

**Phase B flow:**
1. Find stories with ≥1 tag overlap with source
2. Exclude source and descendants (already in Phase A)
3. Sort by tree proximity (same epic → same phase → adjacent → distant)
4. Analyze with conservative prompt ("might be affected, when in doubt skip")
5. Show separate UI section: `[a]pply all / [r]eview individually / [s]kip`

**Flag:** `--auto-update-related` - Auto-apply related updates without prompting

### Yolo mode
`--yolo` enables all `--auto-*` flags: `--auto-pr`, `--auto-merge`, `--auto-clarify`, `--auto-handle-duplicates`, `--auto-add-reverse-deps`, `--auto-update-related`

Still respects hard gates: unmet deps (exit), external deps (prompt for report), human testing.

## Elvish

Ralph is written in Elvish shell. See `docs/learnings/elvish.md` for language-specific patterns and gotchas (arity mismatches, value vs byte pipelines, map access, etc.).

---
<!-- updatedAt: 2026-01-25 -->
<!-- lastCompactedAt: 2026-01-25 -->
