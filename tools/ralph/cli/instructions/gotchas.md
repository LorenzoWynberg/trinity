# Documentation Updates

After completing {{CURRENT_STORY}}:

1. **Add** new gotchas or knowledge to the appropriate book
2. **Correct** any existing docs you discover were wrong or incomplete
3. **Remove** outdated info that no longer applies

If correcting a misconception, note it briefly in the activity log so we know what changed and why.

## Folder Structure

Docs use a book/chapter structure:
```
docs/knowledge/<book>/
├── index.json       # { title, icon, pages: [...] }
├── index.md         # Main/overview chapter
└── <chapter>.md     # Additional chapters
```

## Gotcha Books (`docs/gotchas/`)

| Book | Content |
|------|---------|
| `elvish/` | Elvish shell pitfalls |
| `dashboard/` | React/Next.js hydration, mobile issues, shadcn quirks |
| `go/` | Go module path, workspace sync timing |
| `patterns/` | Reusable patterns discovered |
| `conventions/` | Coding standards learned |

## Knowledge Books (`docs/knowledge/`)

| Book | Content |
|------|---------|
| `ralph/` | Ralph CLI workflow, state management, PRD features |
| `dashboard/` | Dashboard architecture, terminal, themes |
| `trinity/` | Trinity CLI overview and architecture |
| `go/` | Go workspaces, multi-module setup |

## Adding New Chapters

1. Create `<chapter>.md` in the book folder
2. Add entry to `index.json`:
```json
{
  "pages": [
    { "slug": "index", "title": "Overview" },
    { "slug": "new-chapter", "title": "New Chapter Title" }
  ]
}
```
