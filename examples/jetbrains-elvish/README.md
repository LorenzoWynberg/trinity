# JetBrains Elvish Plugin - Ralph Implementation

This is the original Ralph autonomous dev loop implementation from the [jetbrains-elvish](https://github.com/LorenzoWynberg/jetbrains-elvish) plugin project.

## Files

- `ralph.elv` - Main loop script (Elvish shell)
- `prd.json` - Product Requirements Document with stories
- `prompt.md` - Prompt template for Claude Code
- `state.json` - Runtime state (current story, etc.)

## How it works

1. Reads `prd.json` for stories and dependencies
2. Finds next story (not completed, dependencies met)
3. Creates feature branch `feat/story-X.Y.Z`
4. Builds prompt from `prompt.md` template
5. Runs Claude Code with streaming output
6. Detects `STORY_COMPLETE` signal in output
7. Creates PR, merges, cleans up
8. Updates progress, repeats

## Key patterns to port to Go

- Story selection with dependency resolution
- Prompt templating
- Claude Code invocation with streaming
- Completion signal detection
- Git branch/PR workflow
- Progress tracking

## Usage (original)

```bash
cd /path/to/jetbrains-elvish
./scripts/ralph/ralph.elv
```

## Note

This is a reference implementation. Trinity will reimplement this logic in Go with improvements.
