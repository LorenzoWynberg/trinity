# Ralph Learnings

> **TL;DR:** Two-stage completion (passes→merged), blocked state detection with dependency info, activity logs split by project (trinity/ for Ralph's work, ralph/ for human docs), release workflow with human gate and hotfix loop, PR defaults (yes create, no merge), validation flow with clarify/auto-proceed options, external deps flow with report requirement + two-phase propagation (descendants then tag-related), duplicate detection before story creation, reverse dependency suggestions after creation.

## CLI Commands & Flags

> **Note:** Ralph is written in [Elvish](https://elv.sh). See `docs/learnings/elvish.md` for language gotchas.

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

**Clarification flow:** Editor opens with questions as comments → user types answers → injected into Claude's prompt as "## User Clarification" section.

**Flag:** `--auto-clarify` automatically uses auto-proceed mode.

### External Dependencies

Some stories depend on external systems (auth APIs, third-party services). These are tracked in the `external_deps` field and require an implementation report before Claude can proceed.

```
Story STORY-X.Y.Z has external dependencies:
  • Auth API: OAuth endpoints on main website
  • API Keys: User can generate keys in dashboard

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

**Tag on main, not dev:** create PR (dev→main) → merge → checkout main → tag at merge commit → push tag.

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
╔════════════════════════════════════════════════════════╗
║  BLOCKED - WAITING ON DEPENDENCIES
╚════════════════════════════════════════════════════════╝

Unmerged PRs:
  • STORY-1.1.1 (Create Go workspace): https://github.com/...

Pending stories blocked by unmerged work:
  • STORY-1.1.2 (Create CLI entrypoint) → waiting on STORY-1.1.1
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
1. Find stories with ≥1 tag overlap
2. Claude checks semantic similarity (60% threshold)
3. If match: `[u]pdate existing / [c]reate new / [s]kip`

**Flag:** `--auto-handle-duplicates` - Auto-update existing

### Reverse Dependency Check

After creating a story:
1. Find stories with ≥1 tag overlap (excluding earlier phases)
2. Filter: own deps, already dependents, would-create-cycle
3. Claude analyzes which candidates need the new story
4. Prompt: `[y]es add all / [n]o skip / [r]eview individually`

**Safety:** Backwards phase deps rejected, cycle check before each add.

**Flag:** `--auto-add-reverse-deps` - Auto-add all suggestions

### Tag-Based Propagation

External deps propagation runs two phases:

**Phase A:** Descendants - direct dependency tree, high confidence

**Phase B:** Related by tags - not in tree, conservative analysis
1. Find stories with ≥1 tag overlap with source
2. Exclude source and descendants
3. Sort by tree proximity (same epic → same phase → adjacent → distant)
4. Conservative prompt ("might be affected, when in doubt skip")
5. Prompt: `[a]pply all / [r]eview individually / [s]kip`

**Flag:** `--auto-update-related` - Auto-apply related updates

---

## Dashboard

### Terminology
- **Passed** = Claude finished the work (not "completed")
- **Merged** = PR merged to base branch

### Blocked Stories Display
Shows only "first generation" blocked - stories whose blocker is NOT itself blocked.

### Version Filtering
URL param based: `?version=v1.0`. Phases are per-version.

### Hydration Issues
Radix components generate unique IDs at runtime. Server/client mismatch causes hydration errors.

**Fix 1: Suspense boundary** (for useSearchParams):
```tsx
<Suspense fallback={<div className="..." />}>
  <VersionSelectorInner {...props} />
</Suspense>
```

**Fix 2: Extract to client component** (for Tabs in server components):
```tsx
// learnings-tabs.tsx - 'use client'
export function LearningsTabs({ learnings }) { ... }

// page.tsx - server component
<LearningsTabs learnings={learnings} />
```

### Mobile Responsiveness

**Scrollable tabs:** Wrap TabsList for horizontal scroll on mobile:
```tsx
<div className="overflow-x-auto -mx-2 px-2 pb-2">
  <TabsList className="inline-flex w-max md:w-auto">
    {/* triggers */}
  </TabsList>
</div>
```

**Hamburger menu:** Use `mounted` state to avoid hydration mismatch:
```tsx
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])

{mounted && <MobileMenu />}  // Only render after hydration
```

**ReactFlow controls:** Position higher on mobile via CSS:
```css
@media (max-width: 768px) {
  .react-flow__controls { bottom: 80px !important; }
}
```

### UI Components (shadcn)
Always use shadcn CLI to add components - never create them manually:
```bash
npx shadcn@latest add input
npx shadcn@latest add button
# etc.
```

This ensures proper Radix primitives, cva variants, and consistent styling.

### Themes
Four themes available: `light`, `dark`, `cyber-light`, `cyber-dark`

Cyber themes use pink/cyan neon accents. Graph page uses `resolvedTheme` to detect dark mode:
```tsx
const isDark = resolvedTheme === 'dark' || resolvedTheme === 'cyber-dark'
const isCyber = resolvedTheme === 'cyber-dark' || resolvedTheme === 'cyber-light'
```

**Cyber-dark graph colors:**
- Story nodes: Cyan backgrounds, purple text
- Version nodes: Yellow backgrounds, cyan text
- Use Tailwind custom variants: `cyber-dark:bg-cyan-900/80 cyber-dark:text-purple-200`

### Terminal Page

Interactive terminal for running Ralph from the dashboard.

**Architecture:**
- `ws-server.js` - WebSocket server using node-pty for full PTY
- `terminal-view.tsx` - xterm.js client component
- Full PTY support enables interactive programs like `claude`

**node-pty fix:** If you get `posix_spawnp failed` error, rebuild from source:
```bash
rm -rf node_modules/node-pty && npm install node-pty --build-from-source
```
The prebuilt binary may be compiled for a different Node ABI version. Building from source compiles it for your exact Node version. Works on Node 20 and 22.

**Running locally:**
```bash
npm run dev        # Next.js + WebSocket + ngrok (if configured)
npm run dev:local  # Next.js + WebSocket only (no ngrok)
```

### ngrok Setup (Remote Access)

For accessing dashboard from phone/remote:

**Config file:** `tools/ralph/dashboard/ngrok.yml` (gitignored - contains authtoken)

```yaml
version: 3
agent:
  authtoken: YOUR_TOKEN
tunnels:
  dashboard:
    addr: 4000
    proto: http
    domain: your-domain.ngrok.app  # Custom domain (no interstitial)
  terminal:
    addr: 4001
    proto: http  # Random URL (shows interstitial once)
```

**Key points:**
- Hobby plan ($10/mo): 3 endpoints, 1 custom domain
- Custom domain = no "Visit Site" interstitial page
- Random URLs still work but show interstitial
- Terminal WebSocket auto-detected via `/api/tunnels` endpoint
- Get authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
- Reserve domains at https://dashboard.ngrok.com/domains

**Features:**
- Quick command buttons: Run, Stop, Status, Stats
- Command reference modal (top-right info button)
- Ctrl+C support for stopping processes
- Commands execute in `tools/ralph/cli` directory

**Features:**
- Full PTY shell (zsh) - supports interactive programs
- Tab completion and command history work
- TUI apps like `claude` work properly
- Quick command buttons: Run, Stop, Status, Stats

### PRD Tools (Wizard Modals)

Three Claude-powered PRD editing flows on the Stories page (no standalone page):

**1. Story Edit** (pencil icon on story modal, or "Edit Story" button on detail page)
- Input → Review → Complete
- Describe changes, Claude suggests updated acceptance criteria
- Finds related stories (tag overlap ≥2 or dependency relationship)
- Inline edit suggestions before applying

**2. Refine Stories** (button in Stories header)
- Analyze → Review → Complete
- Claude reviews all pending stories for clarity issues
- Suggests improved acceptance criteria
- Inline edit suggestions before applying

**3. Generate Stories** (button in Stories header)
- Input → Review → Complete
- Describe feature in natural language
- Claude generates formatted stories with phase, epic, tags, acceptance
- Inline edit all fields before adding

**Inline editing pattern:**
- Pencil icon on each card expands edit mode
- Acceptance criteria: one per line in textarea
- ✓ to save, ✗ to cancel
- Selection state persists through edit

**API endpoints:**
- `POST/PUT /api/prd/story` - Story edit
- `POST/PUT /api/prd/refine` - Refine stories
- `POST/PUT /api/prd/generate` - Generate stories

---

## Activity Logging

### Organization
```
logs/activity/
├── trinity/        # Ralph writes here (Trinity CLI development)
└── ralph/          # Humans write here (Ralph's own development)
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
<!-- updatedAt: 2026-01-25 -->
<!-- lastCompactedAt: 2026-01-25 -->
