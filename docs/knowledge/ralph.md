# Ralph Knowledge Base

Ralph is your tireless coding companion. Point it at a PRD, grab a coffee (or go to sleep), and let it work through stories one by one - implementing, testing, creating PRs, and merging - all while you're away.

## Quick Start

```bash
# See what's in the queue
./ralph.elv --status

# Start working (Ralph asks before each PR)
./ralph.elv

# Full autopilot - go grab dinner
./ralph.elv --yolo
```

That's it. Ralph picks the next story, implements it, and handles the git flow. You can stop anytime with `Ctrl+C` and resume later with `--resume`.

---

## Common Workflows

### Run overnight
```bash
./ralph.elv --yolo --max-iterations 50
```
Ralph works autonomously - creating and merging PRs. Check the dashboard in the morning.

### Review each PR manually
```bash
./ralph.elv --auto-clarify
```
Ralph handles ambiguous stories but pauses before each PR and merge for your review.

### Work on one specific story
```bash
./ralph.elv --story STORY-1.2.3
```
Target a specific story. Ralph checks dependencies first and tells you if it's blocked.

### Just do the next thing
```bash
./ralph.elv --one
```
Complete one story cycle, then stop cleanly. Great for incremental progress.

### Target a specific version
```bash
./ralph.elv --target-version v2.0
```
Only work on v2.0 stories. Useful when you have multiple versions in the PRD.

---

## Reference

> **TL;DR:** Two-stage completion (passes→merged), blocked state detection with dependency info, activity logs split by project (trinity/ for Ralph's work, ralph/ for human docs), release workflow with human gate and hotfix loop, PR defaults (yes create, no merge), validation flow with clarify/auto-proceed options, external deps flow with report requirement + two-phase propagation (descendants then tag-related), duplicate detection before story creation, reverse dependency suggestions after creation.

## CLI Commands & Flags

> **Note:** Ralph is written in [Elvish](https://elv.sh). See `docs/gotchas/elvish.md` for language pitfalls.

### Quick Reference

```bash
elvish ./ralph.elv [OPTIONS]
# or if executable:
./ralph.elv [OPTIONS]
```

### Auto Flags

| Flag | Description |
|------|-------------|
| `--auto-pr` | Auto-create PR without prompting |
| `--auto-merge` | Auto-merge PR without prompting |
| `--auto-clarify` | Auto-proceed on validation questions |
| `--auto-handle-duplicates` | Auto-update existing story when duplicate detected |
| `--auto-add-reverse-deps` | Auto-add reverse dependencies when suggested |
| `--auto-update-related` | Auto-apply related story updates (tag-based) |
| `--yolo` | Enable ALL auto flags at once |

### Control Flags

| Flag | Description |
|------|-------------|
| `--max-iterations <n>` | Max iterations before auto-stop (default: 100) |
| `--base-branch <name>` | Base branch for story branches (default: dev) |
| `--timeout <seconds>` | Claude timeout (default: 1800) |
| `--target-version <ver>` | Only work on stories for specific version |

### Mode Flags

| Flag | Description |
|------|-------------|
| `--story <ID>` | Work on a specific story (checks deps first) |
| `--one` | Complete one story cycle, then stop |
| `--resume` | Resume from last state |
| `--reset` | Reset state and start fresh |
| `--status` | Show PRD status and exit |
| `--stats` | Show metrics and exit |
| `--version-status` | Show version progress and exit |
| `--plan` | Plan mode (read-only, no changes) |
| `-q, --quiet` | Hide Claude output |
| `-v, --verbose` | Show full prompts/responses |

### Action Flags

| Flag | Description |
|------|-------------|
| `--skip ID "reason"` | Skip a story |
| `--retry-clean ID` | Reset story for retry |

### Release Flags

| Flag | Description |
|------|-------------|
| `--skip-release` | Skip release workflow |
| `--auto-release` | Auto-release without human gate |
| `--release-tag <tag>` | Custom release tag name |

### Other

| Flag | Description |
|------|-------------|
| `--no-notifs` | Disable notifications (default: on) |
| `-h, --help` | Show help |

---

## Workflow

### Story Validation

Before executing a story, Claude validates the acceptance criteria for ambiguity:
```
Story needs clarification:
- What Go version should be used?
- What module path format?

[y]es skip / [n]o stop / [c]larify / [a]uto-proceed
```

Options:
- `[y]` - Skip this story, try the next one (default)
- `[n]` - Stop execution entirely
- `[c]` - Open editor to provide clarification answers
- `[a]` - Auto-proceed with reasonable assumptions

**Clarification flow:** Editor opens with questions as comments -> user types answers -> injected into Claude's prompt as "## User Clarification" section.

**Flag:** `--auto-clarify` automatically uses auto-proceed mode.

### External Dependencies

Some stories depend on external systems (auth APIs, third-party services). These are tracked in the `external_deps` field and require an implementation report before Claude can proceed.

```
Story STORY-X.Y.Z has external dependencies:
  - Auth API: OAuth endpoints on main website
  - API Keys: User can generate keys in dashboard

[r]eport / [n]o skip
```

**No "yes ready" option** - Claude needs to know *how* deps were implemented. You either provide the report or skip.

**Report propagation:** After report is provided:
1. Saved to PRD (`external_deps_report` field)
2. All descendant stories found (recursive traversal)
3. Claude analyzes which need acceptance criteria updates
4. Only relevant stories updated with concrete details

### PR Flow

**Prompts:**
- PR creation: `[y]es / [n]o / [f]eedback`
- PR update (after feedback): `[y]es / [n]o / [f]eedback`
- Merge: `[y]es merge / [n]o leave open / [f]eedback`

All prompts support `[f]eedback` which restarts the Claude loop with user feedback.

**Skipping PR creation:** Story stays in "passed but no PR" state, dependents remain blocked.

### Feedback Loop

All three checkpoints (create PR, update PR, merge) support `[f]eedback`:
1. User enters feedback text via editor ($EDITOR or vim)
2. Feedback becomes the prompt for Claude (uses dedicated feedback template)
3. Claude runs full cycle: implement changes, build, test, format, self-review
4. Returns to the checkpoint where feedback was given

**Prompt templates:**
- `prompt.md` - Main story execution
- `prompts/feedback.md` - Feedback template
- `prompts/partials/workflow.md` - Shared workflow instructions

### Release Workflow

When all stories complete, prompt for release approval:
- `[y]es` - proceed with release
- `[n]o` - cancel
- `[e]dit tag` - change version tag
- `[f]eedback` - run hotfix, then return to prompt

**Tag on main, not dev:** create PR (dev->main) -> merge -> checkout main -> tag at merge commit -> push tag.

**Hotfix flow:** Feedback at release creates hotfix branch from dev, runs Claude, merges back to dev, returns to release prompt.

---

## State Management

### Two-Stage Completion

PRD state tracks two flags per story:
- `passes: true` - Claude completed the work
- `merged: true` - PR merged to base branch

Metrics track three stages:
- `stories_passed` - Claude completed and pushed
- `stories_prd` - PR created on GitHub
- `stories_merged` - PR merged to base branch

**Why this matters:** Dependencies check `merged`, not `passes`. Prevents starting work before code is in dev.

### Blocked State Detection

When no runnable stories exist, Ralph distinguishes:
- **All complete** - every story merged, ready for release
- **Blocked** - stories exist but dependencies aren't met

```
+========================================================+
|  BLOCKED - WAITING ON DEPENDENCIES
+========================================================+

Unmerged PRs:
  - STORY-1.1.1 (Create Go workspace): https://github.com/...

Pending stories blocked by unmerged work:
  - STORY-1.1.2 (Create CLI entrypoint) -> waiting on STORY-1.1.1
```

---

## PRD Features

### Story Tags

Stories have a `tags` array for categorization:

| Category | Tags |
|----------|------|
| Domain | `core`, `cli`, `db`, `git`, `claude`, `prompts`, `auth` |
| Feature | `config`, `prd`, `loop`, `validation`, `recovery`, `release`, `skills` |
| Concern | `api`, `testing`, `ux`, `docs` |

**Uses:** Duplicate detection, propagation, reverse dependency check, dashboard filtering, impact analysis.

### Duplicate Detection

Before creating a story during propagation:
1. Find stories with >=1 tag overlap
2. Claude checks semantic similarity (60% threshold)
3. If match: `[u]pdate existing / [c]reate new / [s]kip`

**Flag:** `--auto-handle-duplicates` - Auto-update existing

### Reverse Dependency Check

After creating a story:
1. Find stories with >=1 tag overlap (excluding earlier phases)
2. Filter: own deps, already dependents, would-create-cycle
3. Claude analyzes which candidates need the new story
4. Prompt: `[y]es add all / [n]o skip / [r]eview individually`

**Safety:** Backwards phase deps rejected, cycle check before each add.

**Flag:** `--auto-add-reverse-deps` - Auto-add all suggestions

### Tag-Based Propagation

External deps propagation runs two phases:

**Phase A:** Descendants - direct dependency tree, high confidence

**Phase B:** Related by tags - not in tree, conservative analysis
1. Find stories with >=1 tag overlap with source
2. Exclude source and descendants
3. Sort by tree proximity (same epic -> same phase -> adjacent -> distant)
4. Conservative prompt ("might be affected, when in doubt skip")
5. Prompt: `[a]pply all / [r]eview individually / [s]kip`

**Flag:** `--auto-update-related` - Auto-apply related updates

---

## Activity Logging

### Organization
```
logs/activity/
+-- trinity/        # Ralph writes here (Trinity CLI development)
+-- ralph/          # Humans write here (Ralph's own development)
```

### Daily Log Format
`logs/activity/YYYY-MM-DD.md` with timestamped entries.

### Including in Prompts
Read 2 most recent logs via `{{RECENT_ACTIVITY_LOGS}}` placeholder.

---

## Technical Details

### Streaming Claude Output

```bash
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'

claude --output-format stream-json < prompt.md 2>&1 | \
  grep --line-buffered '^{' | \
  tee output.json | \
  jq --unbuffered -rj "$stream_text"
```

Key flags: `--line-buffered` on grep, `--unbuffered` on jq, `-rj` for raw output.

---

## FAQ

**Q: Can I stop Ralph mid-story?**
Yes! `Ctrl+C` anytime. Your work is saved. Run `./ralph.elv --resume` to pick up where you left off.

**Q: What if Ralph makes a mistake?**
At any PR prompt, choose `[f]eedback` to tell Ralph what to fix. It'll re-run with your feedback and come back to the same checkpoint.

**Q: How do I skip a problematic story?**
```bash
./ralph.elv --skip STORY-1.2.3 "needs external API first"
```
The story is marked skipped, and dependents can proceed if they don't strictly need it.

**Q: A story is stuck. How do I retry from scratch?**
```bash
./ralph.elv --retry-clean STORY-1.2.3
```
This deletes the branch, clears state, and lets Ralph try again fresh.

**Q: How do I see overall progress?**
```bash
./ralph.elv --status           # PRD overview
./ralph.elv --version-status   # Progress by version
./ralph.elv --stats            # Token usage and costs
```
Or check the dashboard for a visual view.

**Q: Can I run Ralph on multiple versions?**
Yes! Use `--target-version v2.0` to focus on a specific version. Without it, Ralph works through versions in order.

**Q: What's the difference between `passes` and `merged`?**
- `passes` = Claude finished the work and pushed to a branch
- `merged` = The PR was merged into dev

Dependencies check `merged`, not `passes`. This prevents starting work before the code is actually available in dev.

**Q: Ralph says "blocked" - what do I do?**
Check the output - it shows which PRs need merging or which stories are in progress. Merge the blocking PRs and Ralph will continue automatically.
