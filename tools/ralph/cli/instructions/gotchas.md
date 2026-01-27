# Documentation Updates

After completing {{CURRENT_STORY}}:

1. **Add** new gotchas or knowledge to the appropriate book
2. **Correct** any existing docs you discover were wrong or incomplete
3. **Remove** outdated info that no longer applies

If correcting a misconception, note it briefly in the activity log so we know what changed and why.

## Gotchas (`docs/gotchas/`) - Flat structure

One page per book. Just edit `index.md` in the appropriate folder.

| Book | Content |
|------|---------|
| `elvish/` | Elvish shell pitfalls |
| `dashboard/` | React/Next.js hydration, mobile issues, shadcn quirks |
| `go/` | Go module path, workspace sync timing |
| `patterns/` | Reusable patterns discovered |
| `conventions/` | Coding standards learned |

## Knowledge (`docs/knowledge/`) - Hierarchical structure

Multiple chapters per book. Can add new `.md` files.

| Book | Content |
|------|---------|
| `ralph/` | CLI workflow, state management, PRD features (multiple chapters) |
| `dashboard/` | Dashboard architecture, terminal, themes |
| `trinity/` | Trinity CLI overview and architecture |
| `go/` | Go workspaces, multi-module setup |

**Adding a chapter to knowledge:**
1. Create `<chapter>.md` in the book folder
2. Add entry to book's `index.json`:
```json
{
  "pages": [
    { "slug": "index", "title": "Overview" },
    { "slug": "new-chapter", "title": "New Chapter Title" }
  ]
}
```
