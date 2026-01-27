# Documentation Structure

This folder contains all Trinity documentation, organized into two knowledge bases that are rendered in the Ralph Dashboard.

## Structure

```
docs/
├── knowledge/          # Product documentation
│   ├── trinity/        # Trinity CLI (planned Go implementation)
│   ├── ralph/          # Ralph CLI (current Elvish prototype)
│   └── go/             # Go workspace patterns
│
└── gotchas/            # Lessons learned & pitfalls
    ├── conventions/    # Coding standards
    ├── dashboard/      # React/Next.js issues
    ├── elvish/         # Elvish shell quirks
    ├── go/             # Go language gotchas
    └── patterns/       # Design patterns
```

## Book Format

Each book is a folder with:
- `index.json` - Metadata (title, icon, pages list)
- `index.md` - Overview page (required)
- `<chapter>.md` - Additional chapters (optional)

```json
{
  "title": "Ralph",
  "icon": "Terminal",
  "pages": [
    { "slug": "index", "title": "Overview" },
    { "slug": "dashboard", "title": "Dashboard" }
  ]
}
```

## Adding Content

**New chapter:** Create `<slug>.md` in the book folder, add to `index.json` pages array.

**New book:** Create folder with `index.json` + `index.md`.
