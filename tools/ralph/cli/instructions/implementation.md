# Implementation Guidelines

## Scope
Implement ONLY {{CURRENT_STORY}}. No refactoring unrelated code. Note other issues in Learnings only.

## Coding Standards
- Write tests when applicable (unit tests for logic)
- Tests go in appropriate `*_test.go` files
- Follow Go conventions (gofmt, effective go)
- Use existing patterns from the codebase
- Keep changes minimal and focused

## Verification (Required)
```bash
cd /Users/dev-wynberg/Code/trinity-ai-labs/trinity
go work sync
go build ./cli/cmd/trinity 2>&1 || true
go test ./... 2>&1 || true
```

Build must pass. Tests should pass (create them if they don't exist).

## Self-Review (Max 3 cycles) **IMPORTANT**
After build passes, ask: "What's missing or could improve?"
- Edge cases, API design, code organization, error handling
- Only implement if: in scope, meaningful, aligns with acceptance criteria
- Atomic commits per fix, re-run build after each
