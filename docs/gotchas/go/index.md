# Go Gotchas

Common pitfalls when working with Go in this project.

## Module path must match import

The module path in `go.mod` must exactly match how you import it:
- Module: `github.com/trinity-ai-labs/trinity/core`
- Import: `import "github.com/trinity-ai-labs/trinity/core"`

## go work sync timing

Run `go work sync` after:
- Adding new modules to workspace
- Changing module dependencies
- Pulling changes that affect go.mod files

Forgetting this causes "module not found" errors even when the module exists locally.

---
<!-- updatedAt: 2026-01-26 -->
<!-- lastCompactedAt: 2026-01-26 -->
