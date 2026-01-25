# Ralph Learnings

> **TL;DR:** Two-stage completion (passes→merged), blocked state detection with dependency info, activity logs split by project (trinity/ for Ralph's work, ralph/ for human docs), release workflow with human gate and hotfix loop, PR defaults (yes create, no merge).

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

## Elvish

Ralph is written in Elvish shell. See `docs/learnings/elvish.md` for language-specific patterns and gotchas (arity mismatches, value vs byte pipelines, map access, etc.).

---
<!-- updatedAt: 2026-01-25 -->
<!-- lastCompactedAt: 2026-01-25 -->
