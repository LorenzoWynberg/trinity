# Learning Extraction

After each story, Ralph extracts learnings and gotchas from the work done, building institutional knowledge over time.

## What Gets Extracted

**Knowledge** (product documentation):
- How new features work
- Commands and flags added
- Architecture and flow patterns

**Gotchas** (pitfalls to avoid):
- Mistakes made and how they were fixed
- Edge cases discovered
- Non-obvious issues that would trip up developers

## Where It Goes

- Knowledge → `docs/knowledge/*.md`
- Gotchas → `docs/gotchas/*.md`

Ralph creates new files if the topic warrants it, or appends to existing files.

## Feedback Loop Micro-Learnings

In addition to extraction at story completion, Ralph extracts "fix patterns" from feedback loops.

**When it triggers:**
- User provides feedback (something was wrong)
- Claude fixes it
- Story completes successfully

**What gets extracted:**
- **Symptom:** What the user complained about
- **Cause:** Why it happened (from analyzing the fix)
- **Fix:** How to avoid or fix it

**Why this matters:**
- Feedback loops capture real mistakes and their solutions
- These patterns are often the most valuable gotchas
- Tagged with `<!-- From feedback loop on STORY-X.Y.Z -->` for traceability

**Example output:**
```markdown
### Incorrect import path in module

**Symptom:** Build fails with "package not found"

**Cause:** Used relative import instead of full module path

**Fix:** Always use full module path: `github.com/org/repo/pkg`
```

## Automatic Compaction

To prevent unbounded growth, Ralph periodically compacts documentation:

- **Threshold:** 30 days since last compaction
- **Knowledge files:** Restructured for better organization (content preserved)
- **Gotcha files:** Consolidated, removing redundant or outdated entries

Compaction uses Claude to intelligently reorganize while preserving valuable information.

## Metadata Tracking

Files track compaction state via HTML comments:

```markdown
---
<!-- updatedAt: 2024-01-15 -->
<!-- lastCompactedAt: 2024-01-01 -->
```
