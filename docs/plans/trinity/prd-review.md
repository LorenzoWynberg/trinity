# PRD Review - Improvements from Ralph

Based on learnings from Ralph, here's a full review of stories that need updates.

## Summary

| Action | Count | Stories |
|--------|-------|---------|
| UPDATE | 6 | Schema, selection logic, release, git ops |
| ADD | 3 | PR command, PR git ops, dashboard prep |
| REMOVE | 1 | Duplicate release story |

---

## Stories to UPDATE

### STORY-2.1.5: Implement stories table and API
**Current acceptance:**
- stories table created with all fields from schema
- Human testing fields (required, instructions, url, status) stored

**Add to acceptance:**
- Completion tracking fields: `passes`, `merged`, `merge_commit`, `pr_url`, `branch`
- `passes` = Claude completed work, `merged` = PR merged to dev

---

### STORY-2.1.6: Implement story selection logic
**Current acceptance:**
- db.Stories.GetNext() returns story with deps met, not blocked

**Add to acceptance:**
- Dependencies check `merged` field, not `passes`
- Story with `passes=true, merged=false` still blocks dependents

---

### STORY-3.2.3: Implement git sync operations
**Current acceptance:**
- Fetch, Pull, Push, SyncWithBase

**Add to acceptance (or create new story 3.2.4):**
- `CreatePR(path, title, body, base, head)` creates pull request via `gh`
- `MergePR(path, prNumber)` merges PR
- `GetPRStatus(path, prNumber)` returns PR state
- `CreateTag(path, tag, message, commit)` creates annotated tag
- `PushTag(path, tag)` pushes tag to remote

---

### STORY-6.7.2: Implement trinity release command
**Current acceptance:**
- trinity release merges dev to main via PR
- --dry-run shows what would be released
- --tag v1.0.0 creates git tag
- --direct merges without PR
- Validates all stories complete before release

**Replace with:**
- Interactive release with human approval gate
- Shows release summary (stories, commits, files changed)
- Approval prompt: [Y]es / [n]o / [e]dit tag / [f]eedback
- Feedback option runs hotfix and returns to prompt
- Creates PR (dev → main), merges, then tags ON MAIN
- `--auto` flag skips approval (for CI/CD)
- `--dry-run` shows summary without prompt
- Validates all stories have `merged=true`

---

### STORY-5.1.2: Implement story selection in loop
**Current:** Already has "Dependencies resolve on merge to dev, not on completion signal" ✓

**Verify implementation checks `merged` field, not `passes`**

---

### STORY-1.3.1: Add target_version field to story schema
**Current acceptance:**
- Story struct has target_version field

**Add to acceptance:**
- Add completion tracking fields at same time: passes, merged, merge_commit, pr_url, branch
- (Or note dependency on STORY-2.1.5 which adds these)

---

## Stories to ADD

### NEW: STORY-3.2.4 - Implement git PR operations
**Phase:** 3 | **Epic:** 2 | **After:** STORY-3.2.3

**Intent:** Provide PR and tag operations for release workflow

**Acceptance:**
- `core/git/pr.go` exists
- `CreatePR(opts)` creates PR via `gh pr create`
- `MergePR(prNumber)` merges PR via `gh pr merge`
- `GetPR(prNumber)` returns PR status
- `CreateTag(name, message, commit)` creates annotated tag
- `PushTag(name)` pushes tag to remote
- Works with GitHub, GitLab support later

**Depends on:** STORY-3.2.3

---

### NEW: STORY-6.7.3 - Implement trinity pr command
**Phase:** 6 | **Epic:** 7 | **After:** STORY-6.7.2

**Intent:** Allow iteration on PRs before merge via feedback loop

**Acceptance:**
- `trinity pr` shows current story's PR status
- `trinity pr feedback "description"` runs Claude with feedback, updates PR
- `trinity pr merge` merges current PR
- `trinity pr close` closes without merging
- Interactive mode: [m]erge / [f]eedback / [c]lose / [v]iew
- Feedback loop allows multiple iterations without restarting story

**Depends on:** STORY-6.7.2, STORY-3.2.4

---

### NEW: STORY-8.1.1 - Prepare for v2.0 dashboard
**Phase:** 8 (new) | **Epic:** 1

**Intent:** Create API foundation for web dashboard

**Acceptance:**
- `core/api/` package exists
- HTTP handlers for: phases, epics, stories, activity, learnings, metrics, agents
- JSON responses match dashboard data needs
- WebSocket support for live updates (optional, can be polling)
- Handlers reuse existing db.* functions

**Depends on:** Phase 6 complete

**Note:** Actual dashboard is v2.0, this just prepares the API layer.

---

## Stories to REMOVE/CONSOLIDATE

### STORY-1.3.3: Implement release command with git tagging
**Reason:** Duplicates STORY-6.7.2

**Resolution options:**
1. **Remove** - 6.7.2 covers everything
2. **Keep as version-specific** - Make it about `trinity release v1.0` syntax specifically
3. **Merge into 6.7.2** - Combine acceptance criteria

**Recommendation:** Remove. Update 6.7.2 to handle version parameter.

---

## Stories that are GOOD (no changes needed)

- **STORY-5.1.2** - Already mentions merge-based dependency resolution ✓
- **STORY-6.6.1/6.6.2** - Approve/reject flow is solid ✓
- **STORY-6.7.1** - Hotfix command is solid ✓
- **All Phase 4 prompt stories** - Template system is good ✓

---

## Dependency Graph Changes

```
STORY-3.2.3 (git sync)
    ↓
STORY-3.2.4 (git PR ops) [NEW]
    ↓
STORY-6.7.2 (release) [UPDATED]
    ↓
STORY-6.7.3 (pr command) [NEW]
```

---

## Action Items

1. [ ] Update STORY-2.1.5 acceptance (add completion fields)
2. [ ] Update STORY-2.1.6 acceptance (clarify merged check)
3. [ ] Add STORY-3.2.4 (git PR operations)
4. [ ] Update STORY-6.7.2 acceptance (human gate + feedback)
5. [ ] Add STORY-6.7.3 (trinity pr command)
6. [ ] Remove STORY-1.3.3 (duplicate)
7. [ ] Consider STORY-8.1.1 (dashboard API prep)
