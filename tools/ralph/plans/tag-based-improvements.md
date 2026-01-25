# Tag-Based PRD Improvements

> Plan for 3 features that leverage story tags to improve PRD management: duplicate detection, reverse dependency checking, and smarter propagation.

## Overview

With tags now on all stories, we can use them to:
1. Prevent duplicate story creation
2. Catch missing dependencies after story creation
3. Find related stories beyond the dependency tree

All three features apply primarily to `propagate-external-deps` but will also benefit future `add-story` flows.

---

## Feature 1: Duplicate Detection

**Priority:** High
**Risk:** Low
**Status:** Not started

### Problem

When Claude suggests creating a new story during propagation, a similar story might already exist in a different phase/epic. Without detection, we get PRD bloat and duplicate work.

### Example

```
External deps report mentions: "JWT tokens with 1-hour expiry"

Claude suggests creating:
  "Implement token expiration handling" [auth, api]

But 7.1.3 already exists:
  "Implement offline validation fallback" [auth, validation]
  acceptance: "If cached validation > 7 days old, require online validation"

These are related - should we update 7.1.3 instead of creating new?
```

### Solution

Before creating any story, check for potential duplicates:

```
Claude suggests: {title: "Token expiration", tags: [auth, api], ...}
                          ↓
prd:find-similar-by-tags [auth, api] --min-overlap=1
  → Returns: [7.1.1, 7.1.2, 7.1.3, 7.1.4, 7.1.5, 7.1.6]
                          ↓
Claude analyzes titles + intent for semantic similarity:
  "7.1.3 'offline validation fallback' deals with expiration... 70% similar"
                          ↓
Prompt user:
  "Potential duplicate found:"
  "  7.1.3: Implement offline validation fallback [auth, validation]"
  "  New:   Token expiration handling [auth, api]"
  ""
  "[u]pdate 7.1.3 / [c]reate new anyway / [s]kip"
```

### Implementation

**Files to modify:**
- `tools/ralph/cli/lib/claude.elv` - Add duplicate check before create in `propagate-external-deps`

**New function in prd.elv:**
```elvish
# Already exists:
fn find-similar-by-tags {|tags-json &min-overlap=(num 2)|
```

**Changes to propagate-external-deps:**
```elvish
# Before creating each story:
for item $create-items {
  var tags = (echo $item | jq -c '.tags // []')
  var title = (echo $item | jq -r '.title')

  # Find potential duplicates
  var similar = [(prd:find-similar-by-tags $tags &min-overlap=(num 1))]

  if (> (count $similar) 0) {
    # Ask Claude to check semantic similarity
    var duplicate-check = (check-for-duplicate $title $similar)

    if (not (eq $duplicate-check "")) {
      # Prompt user: update existing or create new?
      ...
    }
  }

  # Proceed with create if no duplicate or user chose "create new"
}
```

**Claude prompt for similarity check:**
```
Given this proposed new story:
  Title: "Token expiration handling"
  Intent: "Handle JWT token expiry gracefully"
  Tags: [auth, api]

Check if any of these existing stories cover the same functionality:
  - 7.1.3: "Implement offline validation fallback" [auth, validation]
    Acceptance: "If cached validation > 7 days old..."
  - 7.1.4: "Implement trinity auth login command" [auth, cli]
    Acceptance: "Validates key immediately against API..."

Output:
- If duplicate found: {"duplicate": "7.1.3", "similarity": "high", "reason": "..."}
- If no duplicate: {"duplicate": null}
```

### Acceptance Criteria

- [ ] Before creating story, find stories with ≥1 tag overlap
- [ ] Claude checks semantic similarity of titles/intent
- [ ] If similar (>60% match), prompt user: update/create/skip
- [ ] If user chooses update, modify existing story instead
- [ ] Works in both propagation and future add-story flows

---

## Feature 2: Reverse Dependency Check

**Priority:** Medium
**Risk:** Medium (cycles, over-connection)
**Status:** Not started

### Problem

When we create a new story, existing stories might need to depend on it. We only catch forward dependencies (what the new story depends on), not reverse dependencies (what should depend on the new story).

### Example

```
Created new story:
  7.1.7 "Implement JWT token refresh" [auth, api]
  depends_on: [7.1.2]

Existing story that should probably depend on 7.1.7:
  7.1.6 "Integrate license check into run command" [auth, cli, loop]
  depends_on: [7.1.3, 6.3.1]
  acceptance: "If key invalid/expired, show error and exit"

  → 7.1.6 handles expiry but doesn't know about refresh!
  → Should depend on 7.1.7 so refresh is available
```

### Solution

After creating a story, analyze what existing stories might need to depend on it:

```
Created: 7.1.7 "JWT token refresh" [auth, api]
                          ↓
Find stories with overlapping tags [auth, api]:
  → [7.1.1, 7.1.2, 7.1.3, 7.1.4, 7.1.5, 7.1.6, 6.3.3]
                          ↓
Filter out:
  - Stories that 7.1.7 depends on (avoid cycles)
  - Stories that already depend on 7.1.7
  - Stories in earlier phases (they came first conceptually)
                          ↓
Remaining candidates: [7.1.6, 6.3.3]
                          ↓
Claude analyzes: "Should any of these depend on 7.1.7?"
  → "7.1.6 handles token expiry - YES, should depend on 7.1.7"
  → "6.3.3 feedback loops - NO, unrelated to token refresh"
                          ↓
Show as SUGGESTIONS (not auto-applied):
  "Suggested dependency additions:"
  "  7.1.6 should depend on 7.1.7 (uses token expiry logic)"
  ""
  "[y]es add / [n]o skip / [r]eview individually"
```

### Why Advisory Only

Auto-adding dependencies is risky:
1. **Cycles:** A → B → C → A breaks the DAG
2. **Over-connection:** Everything auth-related depends on everything else
3. **Wrong phase order:** Phase 6 story depending on Phase 7 story is backwards
4. **User intent:** Maybe they WANT loose coupling

By making it advisory, user reviews and approves each suggestion.

### Implementation

**Files to modify:**
- `tools/ralph/cli/lib/claude.elv` - Add reverse dep check after create
- `tools/ralph/cli/lib/prd.elv` - Add `add-dependency` function

**New functions:**
```elvish
# prd.elv
fn add-dependency {|story-id new-dep|
  var tmp = (mktemp)
  jq '(.stories[] | select(.id == "'$story-id'")).depends_on += ["'$new-dep'"]' $prd-file > $tmp
  mv $tmp $prd-file
}

fn would-create-cycle {|story-id potential-dep|
  # Check if adding potential-dep to story-id's deps would create cycle
  # i.e., is story-id in potential-dep's descendant tree?
  var descendants = [(get-descendants $potential-dep)]
  has-value $descendants $story-id
}
```

**Claude prompt for reverse dep analysis:**
```
New story created:
  7.1.7 "Implement JWT token refresh" [auth, api]
  Intent: "Provide token refresh capability for expired JWTs"

These existing stories have overlapping tags and might need to depend on 7.1.7:

  7.1.6 "Integrate license check into run command" [auth, cli, loop]
    Current deps: [7.1.3, 6.3.1]
    Acceptance: "If key invalid/expired, show error..."

  6.3.3 "Feedback loops at checkpoints" [cli, claude, api]
    Current deps: [6.3.1, 3.2.4]
    Acceptance: "After story passes, prompt..."

For each story, determine if it LOGICALLY needs 7.1.7 to function correctly.

Output format:
{
  "suggestions": [
    {"id": "7.1.6", "should_depend": true, "reason": "Handles expiry, needs refresh"},
    {"id": "6.3.3", "should_depend": false, "reason": "Unrelated to auth tokens"}
  ]
}
```

### Acceptance Criteria

- [ ] After creating story, find candidates with overlapping tags
- [ ] Filter out: own dependencies, already-dependents, would-create-cycle
- [ ] Claude analyzes logical dependency need
- [ ] Show suggestions to user (not auto-applied)
- [ ] User can accept all, reject all, or review individually
- [ ] Validate no cycles before adding any dependency
- [ ] Update PRD only after user confirmation

---

## Feature 3: Smarter Propagation (Tag-Based Expansion)

**Priority:** Low
**Risk:** High (scope creep, false positives)
**Status:** Not started

### Problem

Current propagation only analyzes **descendants** (stories that depend on the source story). But related work might exist elsewhere that shares tags but has no dependency link.

### Example

```
PRD structure:
  Phase 3: Integrations
    3.1.6 "Token usage parsing" [claude, core, api]
      → Parses Claude API tokens for cost tracking

  Phase 6: CLI Commands
    6.3.3 "Feedback loops" [cli, claude, api]
      → Calls APIs during feedback loop

  Phase 7: Auth
    7.1.2 "License validation" [auth, api] ← external_deps source
      depends_on: [7.1.1]

Descendants of 7.1.2: [7.1.3, 7.1.4, 7.1.5, 7.1.6]
```

User provides License API report: "POST /api/licenses/validate, returns JWT, requires API key header"

**Current behavior:**
```
Analyze descendants only: [7.1.3, 7.1.4, 7.1.5, 7.1.6]
✓ Updates auth-related stories in Phase 7
✗ Misses 6.3.3 which also makes API calls
```

**With tag expansion:**
```
Descendants: [7.1.3, 7.1.4, 7.1.5, 7.1.6]
Stories with [api] tag: [2.1.5, 3.1.6, 6.3.3, 7.1.2, ...]
Combined (dedupe): [7.1.3, 7.1.4, 7.1.5, 7.1.6, 2.1.5, 3.1.6, 6.3.3]

Analyze all:
  ✓ 7.1.3-7.1.6 - direct descendants, high relevance
  ? 6.3.3 - makes API calls, might need auth header
  ○ 3.1.6 - different API (Claude), skip
  ○ 2.1.5 - database API, skip
```

### Solution

Optionally expand propagation scope using tag similarity:

```
propagate-external-deps --include-related
                          ↓
1. Get descendants (existing): [7.1.3, 7.1.4, 7.1.5, 7.1.6]
2. Get tag-related (new): stories with ≥1 overlapping tag
   Source tags: [auth, api]
   Matches: [3.1.6, 6.3.3, 2.1.5, ...]
3. Dedupe and categorize:
   - Descendants (high confidence)
   - Related (lower confidence, needs review)
                          ↓
Analyze in two batches, show separately:

  "Direct descendants (4 stories):"
    ✓ 7.1.3 - updated (added JWT format details)
    ✓ 7.1.4 - updated (added endpoint URL)
    ○ 7.1.5 - unchanged (not relevant)
    ○ 7.1.6 - unchanged (already complete)

  "Related by tags (3 stories) - review recommended:"
    ? 6.3.3 - might need auth header for API calls
    ○ 3.1.6 - different API, skip
    ○ 2.1.5 - database layer, skip

  "[a]pply related updates / [r]eview individually / [s]kip related"
```

### Why Optional/Flagged

Tag expansion can cause:
1. **Scope creep:** Analyzing 50 stories instead of 5
2. **False positives:** Updating stories that don't need it
3. **Cost:** More Claude API calls for analysis
4. **Noise:** User has to review more suggestions

Making it opt-in (`--include-related`) lets users choose when they want deeper analysis.

### Implementation

**Files to modify:**
- `tools/ralph/cli/lib/claude.elv` - Add `--include-related` handling
- `tools/ralph/cli/lib/cli.elv` - Add flag

**Modified propagate-external-deps:**
```elvish
fn propagate-external-deps {|story-id report &include-related=$false|
  # Get source story tags
  var source-tags = (prd:get-story-tags $story-id)

  # Get descendants (existing)
  var descendants = [(prd:get-descendants $story-id)]

  # Optionally get tag-related stories
  var related = []
  if $include-related {
    var all-related = [(prd:find-similar-by-tags $source-tags &min-overlap=(num 1))]
    # Filter out descendants (already covered) and source
    for r $all-related {
      if (and (not (eq $r $story-id)) (not (has-value $descendants $r))) {
        set related = [$@related $r]
      }
    }
  }

  # Analyze descendants (high confidence)
  if (> (count $descendants) 0) {
    analyze-and-update $descendants $report "descendants"
  }

  # Analyze related (lower confidence, separate UI)
  if (> (count $related) 0) {
    analyze-and-update $related $report "related"
  }
}
```

**Modified Claude prompt:**
```
# For descendants (high confidence):
"These stories DEPEND on the source story. Analyze for updates."

# For related (lower confidence):
"These stories share tags but don't depend on the source.
They MIGHT be affected. Be conservative - only suggest updates
if clearly necessary. When in doubt, skip."
```

### Acceptance Criteria

- [ ] Add `--include-related` flag to propagation
- [ ] Find stories with ≥1 tag overlap (excluding descendants)
- [ ] Analyze related stories separately from descendants
- [ ] Show related results in separate UI section
- [ ] User can apply/skip related updates independently
- [ ] Conservative Claude prompt for related (fewer false positives)
- [ ] Default is OFF (existing behavior unchanged)

---

## Implementation Order

| Order | Feature | Effort | Value | Risk |
|-------|---------|--------|-------|------|
| 1 | Duplicate Detection | Medium | High | Low |
| 2 | Reverse Dependency | Medium | Medium | Medium |
| 3 | Tag Expansion | High | Medium | High |

**Recommended approach:**
1. Implement duplicate detection first - highest ROI
2. Add reverse dependency as advisory feature
3. Tag expansion later, after seeing how 1 & 2 work in practice

---

## Testing Plan

### Duplicate Detection
1. Create story with same tags as existing
2. Verify similarity check triggers
3. Test "update existing" path
4. Test "create new anyway" path

### Reverse Dependency
1. Create story, verify candidates found
2. Verify cycle detection works
3. Test suggestion acceptance flow
4. Verify PRD updated correctly

### Tag Expansion
1. Run propagation without flag (existing behavior)
2. Run with `--include-related`
3. Verify related stories found
4. Verify separate UI sections
5. Test conservative analysis (fewer false positives)

---

## Open Questions

1. **Similarity threshold:** What % similarity triggers duplicate warning? 60%? 70%?
2. **Tag overlap minimum:** ≥1 tag or ≥2 tags for related stories?
3. **Phase ordering:** Should Phase 6 stories ever depend on Phase 7? Or is that always backwards?
4. **Performance:** How many stories is too many to analyze at once?

---

*Created: 2026-01-25 ~16:30 CR*
