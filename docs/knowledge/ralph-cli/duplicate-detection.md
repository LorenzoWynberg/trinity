# Duplicate Detection

When propagating stories or adding new ones, Ralph checks for potential duplicates.

## Detection Process

1. Find stories with ≥1 overlapping tag
2. Claude compares semantic similarity
3. If similarity ≥60%, flag as potential duplicate

## Duplicate Prompt

```
Potential duplicate found:
  Existing: "Add user authentication" (1.1.2)
  New:      "Implement login system"

[u]pdate existing / [c]reate new / [s]kip
```

- **update** - Merge new story into existing (Claude updates acceptance criteria, etc.)
- **create** - Create as separate story anyway
- **skip** - Don't create the new story

## Auto Mode

Use `--auto-handle-duplicates` to automatically update existing stories when duplicates are detected.

```bash
./ralph.elv --auto-handle-duplicates
./ralph.elv --yolo  # Includes this flag
```
