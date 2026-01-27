# FAQ

## Can I stop Ralph mid-story?

Yes! `Ctrl+C` anytime. Your work is saved. Run `./ralph.elv --resume` to pick up where you left off.

---

## What if Ralph makes a mistake?

At any PR prompt, choose `[f]eedback` to tell Ralph what to fix. It'll re-run with your feedback and come back to the same checkpoint.

---

## How do I skip a problematic story?

```bash
./ralph.elv --skip STORY-1.2.3 "needs external API first"
```

The story is marked skipped, and dependents can proceed if they don't strictly need it.

---

## A story is stuck. How do I retry from scratch?

```bash
./ralph.elv --retry-clean STORY-1.2.3
```

This deletes the branch, clears state, and lets Ralph try again fresh.

---

## How do I see overall progress?

```bash
./ralph.elv --status           # PRD overview
./ralph.elv --version-status   # Progress by version
./ralph.elv --stats            # Token usage and costs
```

Or check the dashboard for a visual view.

---

## Can I run Ralph on multiple versions?

Yes! Use `--target-version v2.0` to focus on a specific version. Without it, Ralph works through versions in order.

---

## What's the difference between `passes` and `merged`?

- `passes` = Claude finished the work and pushed to a branch
- `merged` = The PR was merged into dev

Dependencies check `merged`, not `passes`. This prevents starting work before the code is actually available in dev.

---

## Ralph says "blocked" - what do I do?

Check the output - it shows which PRs need merging or which stories are in progress. Merge the blocking PRs and Ralph will continue automatically.

---

## What are external dependencies?

Some stories depend on external systems (auth APIs, third-party services). These require an implementation report before Claude can proceed:

```
Story STORY-X.Y.Z has external dependencies:
  - Auth API: OAuth endpoints on main website

[r]eport / [n]o skip
```

You must provide the report (endpoints, schemas, etc.) or skip. No "yes ready" option.

---

## How does duplicate detection work?

Before creating a story during propagation:
1. Find stories with ≥1 tag overlap
2. Claude checks semantic similarity (60% threshold)
3. If match: `[u]pdate existing / [c]reate new / [s]kip`

Use `--auto-handle-duplicates` to auto-update existing stories.
