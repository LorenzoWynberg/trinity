# Claude Communication

How Ralph communicates with Claude CLI for reliable prompt handling.

## Temp File Pattern

All Claude invocations use temp files to avoid shell escaping issues:

```
write prompt → /tmp/claude-prompt-XXXXXX
run claude < temp-file
read output
cleanup temp file
```

**Why temp files:**
- No shell escaping issues with quotes, newlines, JSON
- No command line argument size limits
- Consistent across all invocations
- Easier debugging (can inspect temp files on failure)

## Main Loop (Streaming)

The main story execution streams output live:

```elvish
timeout $timeout claude --dangerously-skip-permissions \
  --verbose --print --output-format stream-json \
  < $prompt-file 2>&1 \
  | grep --line-buffered '^{' \
  | tee $output-file \
  | jq --unbuffered -rj $stream-text
```

**Components:**
- `--output-format stream-json` - JSON events as Claude works
- `grep --line-buffered` - filter to JSON lines only
- `tee $output-file` - save for signal detection
- `jq --unbuffered` - extract and display text in real-time

## Helper Functions (Non-Streaming)

Quick analysis calls use `run-claude` function:

```elvish
var result = (run-claude $prompt)
if $result[success] {
  # use $result[output]
}
```

**Used by:**
- `validate-story` - acceptance criteria check
- `refine-prd` - story refinement analysis
- `add-stories-from-description` - story generation
- `check-for-duplicate` - duplicate detection
- `check-reverse-deps` - dependency analysis
- `generate-commit-message` - commit message generation

These don't need streaming - they're quick calls that just need the final result.

## Signal Detection

Claude signals completion via `signal.json`:

```json
{
  "status": "complete",
  "story_id": "1.2.3",
  "files_changed": ["src/foo.ts"],
  "tests_passed": true
}
```

**Status values:**
- `complete` - story done, ready for PR
- `blocked` - story can't proceed
- `all_complete` - all stories in version done

Falls back to XML tags in output for backwards compatibility.

## Dashboard Pattern

Dashboard uses same pattern via `lib/claude.ts`:

```typescript
export async function runClaude(prompt: string): Promise<ClaudeResult> {
  // Write prompt to /tmp/claude-prompt-{uuid}.md
  // Tell Claude to write response to /tmp/claude-response-{uuid}.json
  // Run claude from PROJECT_ROOT (trinity/)
  // Read and parse response
  // Cleanup both files
}
```

**Key detail:** Dashboard runs Claude from the project root (`PROJECT_ROOT`), not from `tools/ralph/cli`. This ensures Claude has the correct context and can access all project files.

All API routes use this for PRD operations (refine, generate, story edit).
