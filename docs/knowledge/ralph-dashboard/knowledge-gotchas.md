# Knowledge & Gotchas

The knowledge and gotchas pages display documentation using a book/chapter structure.

## Structure

Both pages use identical navigation and rendering:

```
docs/<knowledge|gotchas>/<book>/
├── index.json           # Book metadata + page order
├── index.md             # Overview (required)
└── <chapter>.md         # Additional chapters (optional)
```

## Navigation

- **Book dropdown** - Shows all books with icons from `index.json`
- **Chapter dropdown** - Only appears when book has multiple pages
- **URL params** - `?book=ralph-cli&chapter=cli-reference`

## index.json Schema

```json
{
  "title": "Ralph CLI",
  "description": "Ralph CLI workflows and reference",
  "icon": "Terminal",
  "pages": [
    { "slug": "index", "title": "Overview" },
    { "slug": "cli-reference", "title": "CLI Reference" }
  ]
}
```

## Adding a Chapter

1. Create `<chapter-slug>.md` in the book folder
2. Add entry to `index.json` pages array

## Available Icons

Icons come from Lucide React. Common options:
- `Terminal` - CLI tools
- `LayoutDashboard` - Dashboards
- `BookOpen` - Documentation
- `Code` - Code/programming
- `Settings` - Configuration

## ChapterNav Component

`src/components/chapter-nav.tsx` handles navigation:
- Book dropdown shows all books with icons
- Chapter dropdown only appears when book has multiple pages
- Same component used for both Knowledge and Gotchas pages
