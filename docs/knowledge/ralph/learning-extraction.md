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
