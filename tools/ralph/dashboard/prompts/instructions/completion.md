# Phase 4-5: Verify & Complete

## Verification

```bash
npm run build   # or go build, etc.
npm run lint    # if available
npm test        # if tests exist
```

---

## On FIX NEEDED

1. Analyze the error output
2. Make minimal fix
3. Re-verify (max 3 cycles)

Still failing after 3 attempts → BLOCKED

---

## On SUCCESS

1. **Log activity** - POST to activity endpoint
   - storyId, title, content, filesChanged, tags

2. **Signal complete** - POST to signal endpoint
   - action: "complete"

Note: Don't commit - the execution system handles commit/PR after signal.

---

## On BLOCKED

Don't commit incomplete work.

1. **Log attempt** - POST to activity endpoint
   - status: "blocked", error messages, fixes tried

2. **Signal blocked** - POST to signal endpoint
   - action: "blocked", message: why + what was tried
