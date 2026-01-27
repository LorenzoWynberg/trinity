# Advanced Features

Deep dive into Ralph's advanced capabilities.

## Reverse Dependency Management

When Claude completes a story, it may discover that other stories should depend on the completed work. Ralph detects and manages these "reverse dependencies."

### How It Works

1. After story completion, Claude analyzes what was built
2. It identifies other pending stories that should depend on this work
3. Ralph prompts: `[a]dd deps / [r]eview individually / [s]kip`

### Options

- **Add deps** - Automatically add reverse dependencies to all suggested stories
- **Review individually** - Review each suggestion one by one
- **Skip** - Don't add any reverse dependencies

### Auto Mode

Use `--auto-add-reverse-deps` to automatically add suggested reverse dependencies without prompting.

```bash
./ralph.elv --auto-add-reverse-deps
./ralph.elv --yolo  # Includes this flag
```

### Why This Matters

Without reverse deps, later stories might:
- Duplicate work that's already done
- Miss important context from earlier implementation
- Break patterns established in completed stories

---

## Learning Extraction

After each story, Ralph extracts learnings and gotchas from the work done, building institutional knowledge over time.

### What Gets Extracted

**Knowledge** (product documentation):
- How new features work
- Commands and flags added
- Architecture and flow patterns

**Gotchas** (pitfalls to avoid):
- Mistakes made and how they were fixed
- Edge cases discovered
- Non-obvious issues that would trip up developers

### Where It Goes

- Knowledge → `docs/knowledge/*.md`
- Gotchas → `docs/gotchas/*.md`

Ralph creates new files if the topic warrants it, or appends to existing files.

### Automatic Compaction

To prevent unbounded growth, Ralph periodically compacts documentation:

- **Threshold:** 30 days since last compaction
- **Knowledge files:** Restructured for better organization (content preserved)
- **Gotcha files:** Consolidated, removing redundant or outdated entries

Compaction uses Claude to intelligently reorganize while preserving valuable information.

### Metadata Tracking

Files track compaction state via HTML comments:

```markdown
---
<!-- updatedAt: 2024-01-15 -->
<!-- lastCompactedAt: 2024-01-01 -->
```

---

## Release Workflow

When all stories in a version are complete, Ralph initiates the release workflow.

### Release Flow

1. **Summary** - Shows version, story count, commit count, files changed
2. **Human Gate** - Prompts for approval (unless `--auto-release`)
3. **Release PR** - Creates PR from dev → main
4. **Merge** - Merges the release PR
5. **Tag** - Creates annotated tag on main
6. **Push** - Pushes tag to origin

### Release Prompt Options

```
[y]es release  [n]o cancel  [e]dit tag  [f]eedback
```

- **yes** - Proceed with release
- **no** - Cancel (can resume later)
- **edit** - Change the release tag name
- **feedback** - Provide feedback for a hotfix

### Hotfix Flow

If you choose `[f]eedback`:

1. Opens editor for you to describe what needs fixing
2. Creates `hotfix/release-<version>` branch from dev
3. Claude implements the fix based on your feedback
4. Creates PR, merges to dev
5. Returns to release prompt to try again

This loop continues until you approve or cancel.

### Release Flags

| Flag | Description |
|------|-------------|
| `--skip-release` | Skip release workflow entirely |
| `--auto-release` | Skip human gate, release automatically |
| `--release-tag <tag>` | Custom tag name (default: version name) |

### After Release

- Version marked as released in PRD
- Tag pushed to origin
- Ralph returns to dev branch

---

## Duplicate Detection

When propagating stories or adding new ones, Ralph checks for potential duplicates.

### Detection Process

1. Find stories with ≥1 overlapping tag
2. Claude compares semantic similarity
3. If similarity ≥60%, flag as potential duplicate

### Duplicate Prompt

```
Potential duplicate found:
  Existing: "Add user authentication" (1.1.2)
  New:      "Implement login system"

[u]pdate existing / [c]reate new / [s]kip
```

- **update** - Merge new story into existing (Claude updates acceptance criteria, etc.)
- **create** - Create as separate story anyway
- **skip** - Don't create the new story

### Auto Mode

Use `--auto-handle-duplicates` to automatically update existing stories when duplicates are detected.

```bash
./ralph.elv --auto-handle-duplicates
./ralph.elv --yolo  # Includes this flag
```

---

## Story Validation & Clarification

Before implementing a story, Ralph validates it and may ask clarifying questions.

### Validation Checks

- Is the intent clear?
- Are acceptance criteria testable?
- Are there ambiguities that need resolution?

### Clarification Prompt

```
Story STORY-1.2.3 needs clarification:
  - Should login support OAuth or just email/password?
  - What should happen on failed login attempts?

[c]larify (edit story) / [a]uto-proceed (make assumptions)
```

- **clarify** - Opens editor to update story details
- **auto-proceed** - Claude makes reasonable assumptions and proceeds

### Auto Mode

Use `--auto-clarify` to automatically proceed with reasonable assumptions.

```bash
./ralph.elv --auto-clarify
./ralph.elv --yolo  # Includes this flag
```

---

## Related Story Updates

When completing a story, Ralph may identify related stories (via tags) that should be updated.

### How It Works

1. Find stories sharing tags with completed story
2. Claude analyzes if they need updates based on what was implemented
3. Ralph prompts with suggested changes

### Auto Mode

Use `--auto-update-related` to automatically apply suggested updates.

```bash
./ralph.elv --auto-update-related
./ralph.elv --yolo  # Includes this flag
```
