# Release Workflow

When all stories in a version are complete, Ralph initiates the release workflow.

## Release Flow

1. **Summary** - Shows version, story count, commit count, files changed
2. **Human Gate** - Prompts for approval (unless `--auto-release`)
3. **Release PR** - Creates PR from dev → main
4. **Merge** - Merges the release PR
5. **Tag** - Creates annotated tag on main
6. **Push** - Pushes tag to origin

## Release Prompt

```
[y]es release  [n]o cancel  [e]dit tag  [f]eedback
```

- **yes** - Proceed with release
- **no** - Cancel (can resume later)
- **edit** - Change the release tag name
- **feedback** - Provide feedback for a hotfix

## Hotfix Flow

If you choose `[f]eedback`:

1. Opens editor for you to describe what needs fixing
2. Creates `hotfix/release-<version>` branch from dev
3. Claude implements the fix based on your feedback
4. Creates PR, merges to dev
5. Returns to release prompt to try again

This loop continues until you approve or cancel.

## Release Flags

| Flag | Description |
|------|-------------|
| `--skip-release` | Skip release workflow entirely |
| `--auto-release` | Skip human gate, release automatically |
| `--release-tag <tag>` | Custom tag name (default: version name) |

## After Release

- Version marked as released in PRD
- Tag pushed to origin
- Ralph returns to dev branch
