# Common Workflows

## Run Overnight
```bash
./ralph.elv --yolo --max-iterations 50
```
Ralph works autonomously - creating and merging PRs. Check the dashboard in the morning.

## Review Each PR Manually
```bash
./ralph.elv --auto-clarify
```
Ralph handles ambiguous stories but pauses before each PR and merge for your review.

## Work on One Specific Story
```bash
./ralph.elv --story STORY-1.2.3
```
Target a specific story. Ralph checks dependencies first and tells you if it's blocked.

## Just Do the Next Thing
```bash
./ralph.elv --one
```
Complete one story cycle, then stop cleanly. Great for incremental progress.

## Target a Specific Version
```bash
./ralph.elv --target-version v2.0
```
Only work on v2.0 stories. Useful when you have multiple versions in the PRD.

---

## Story Validation

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

**Flag:** `--auto-clarify` automatically uses auto-proceed mode.

---

## PR Flow

**Prompts:**
- PR creation: `[y]es / [n]o / [f]eedback`
- PR update (after feedback): `[y]es / [n]o / [f]eedback`
- Merge: `[y]es merge / [n]o leave open / [f]eedback`

All prompts support `[f]eedback` which restarts the Claude loop with user feedback.

---

## Feedback Loop

All three checkpoints (create PR, update PR, merge) support `[f]eedback`:
1. User enters feedback text via editor ($EDITOR or vim)
2. Feedback becomes the prompt for Claude
3. Claude runs full cycle: implement changes, build, test, format, self-review
4. Returns to the checkpoint where feedback was given

---

## Release Workflow

When all stories complete, prompt for release approval:
- `[y]es` - proceed with release
- `[n]o` - cancel
- `[e]dit tag` - change version tag
- `[f]eedback` - run hotfix, then return to prompt

**Tag on main, not dev:** create PR (dev→main) → merge → checkout main → tag at merge commit → push tag.

---

## Blocked State

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
  - STORY-1.1.2 (Create CLI entrypoint) → waiting on STORY-1.1.1
```
