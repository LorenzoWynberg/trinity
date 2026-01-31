# Go Knowledge Base

> **TL;DR:** Use `go.work` for multi-module repos, `replace` directive for local modules, always run `go work sync` after changes.

## Workspaces

### Multi-module monorepo setup
Go workspaces allow working with multiple modules locally without publishing.

```
project/
+-- go.work          # Workspace file
+-- core/
|   +-- go.mod       # module github.com/org/project/core
+-- cli/
    +-- go.mod       # module github.com/org/project/cli
```

**go.work:**
```go
go 1.23

use (
    ./cli
    ./core
)
```

### Local module references
For unpublished modules, use `replace` directive:

```go
// cli/go.mod
module github.com/org/project/cli

require github.com/org/project/core v0.0.0

replace github.com/org/project/core => ../core
```

- Version `v0.0.0` is standard for unpublished modules
- `replace` directive points to local path
- `go work sync` updates workspace after changes

## Best Practices

- Keep each module focused (core for shared logic, cli for CLI app)
- Use workspaces for local development, not for publishing
- Version core functionality before CLI depends on it in production
