# Smart Story Selection

Ralph uses an intelligent scoring system to pick the optimal next story, maximizing context retention and throughput.

## Why It Matters

Without smart selection, Ralph picks the first runnable story - leading to context thrashing:

```
Random walk:
  auth-login → payments-stripe → auth-logout → payments-refund
  [cold start] [cold start]     [cold start]  [cold start]

Smart selection:
  auth-login → auth-logout → auth-refresh → payments-stripe → payments-refund
  [cold start] [warm]        [hot]          [cold start]     [warm]
```

Completing related stories together means Claude retains knowledge of patterns, files, and architecture.

## Scoring Model

Each runnable story is scored. Highest score wins.

| Factor | Weight | Description |
|--------|--------|-------------|
| Tree Proximity | 5.0 | Same epic (1.0), same phase (0.5), other (0.0) |
| Tag Overlap | 3.0 | Jaccard similarity with last-completed story |
| Blocker Value | 2.0 | How many stories does this unblock? |
| Priority | 1.0 | User-defined priority field (0-10) |
| Inverse Complexity | 0.5 | Simpler stories (fewer acceptance criteria) break ties |

### Tree Proximity (Highest Priority)

Stories in the same epic share files, patterns, and domain knowledge. Ralph finishes the epic before moving on.

```
Same epic:     score += 5.0   (full context)
Same phase:    score += 2.5   (partial context)
Other phase:   score += 0.0   (cold start)
```

### Tag Overlap

Catches cross-cutting concerns the tree might miss. A `frontend` story in Auth shares context with a `frontend` story in Dashboard.

Uses Jaccard similarity: `|A ∩ B| / |A ∪ B|`

### Blocker Value

Stories that unblock the most downstream work get priority. Maximizes parallelism for future runs.

### Priority Override

Set `priority` in the PRD to force ordering:

```json
{
  "id": "STORY-1.2.3",
  "priority": 10,
  ...
}
```

## State Tracking

Ralph tracks `last_completed` in `state.json` to inform scoring:

```json
{
  "last_completed": "STORY-1.1.2",
  ...
}
```

This persists across sessions, so resuming after a break continues with context.

## Implementation

Key functions in `lib/prd.elv`:

- `score-story` - Calculate composite score
- `calc-tree-proximity` - Phase/epic distance
- `calc-tag-overlap` - Jaccard similarity
- `calc-blocker-value` - Count downstream dependents
- `get-next-story` - Scores all candidates, returns highest

The scoring happens automatically - no flags needed.
