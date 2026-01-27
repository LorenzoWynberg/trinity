# Reverse Dependencies

When Claude completes a story, it may discover that other stories should depend on the completed work. Ralph detects and manages these "reverse dependencies."

## How It Works

1. After story completion, Claude analyzes what was built
2. It identifies other pending stories that should depend on this work
3. Ralph prompts: `[a]dd deps / [r]eview individually / [s]kip`

## Options

- **Add deps** - Automatically add reverse dependencies to all suggested stories
- **Review individually** - Review each suggestion one by one
- **Skip** - Don't add any reverse dependencies

## Auto Mode

Use `--auto-add-reverse-deps` to automatically add suggested reverse dependencies without prompting.

```bash
./ralph.elv --auto-add-reverse-deps
./ralph.elv --yolo  # Includes this flag
```

## Why This Matters

Without reverse deps, later stories might:
- Duplicate work that's already done
- Miss important context from earlier implementation
- Break patterns established in completed stories
