# Gotchas

Common pitfalls, mistakes to avoid, and lessons learned. Updated by Claude and Ralph after each task.

## Structure

| File | Description |
|------|-------------|
| [elvish.md](elvish.md) | Elvish shell pitfalls (values vs bytes, arity, map access) |
| [dashboard.md](dashboard.md) | React/Next.js hydration, mobile issues, shadcn quirks |
| [go.md](go.md) | Go module path, workspace sync timing |
| [patterns.md](patterns.md) | Reusable patterns discovered |
| [conventions.md](conventions.md) | Coding standards learned |

## How This Works

```
+------------------------------------------+
|  Start task                              |
|    |                                     |
|  Read relevant gotchas/*.md files        |
|    |                                     |
|  Do work, discover pitfalls              |
|    |                                     |
|  Write new gotchas to appropriate file   |
|    |                                     |
|  Next task avoids the same mistakes      |
+------------------------------------------+
```

## Updating Gotchas

### Adding
1. Identify the appropriate file based on topic
2. Add under the relevant section
3. Keep entries concise (1-2 lines)
4. Focus on actionable insights, not obvious things

### Correcting
If you discover something was **wrong or incomplete**:
1. Update or remove the incorrect entry
2. Add the correct information
3. Note the correction in today's activity log

### Removing
Delete entries that are:
- No longer accurate (API changed, etc.)
- Redundant (covered elsewhere)
- Too obvious to be useful

## Related

- `docs/knowledge/` - Product documentation of features
- `docs/ARCHITECTURE.md` - High-level system design
