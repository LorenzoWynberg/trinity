# Story Validation

Before implementing a story, Ralph validates it and may ask clarifying questions.

## Validation Checks

- Is the intent clear?
- Are acceptance criteria testable?
- Are there ambiguities that need resolution?

## Clarification Prompt

```
Story STORY-1.2.3 needs clarification:
  - Should login support OAuth or just email/password?
  - What should happen on failed login attempts?

[c]larify (edit story) / [a]uto-proceed (make assumptions)
```

- **clarify** - Opens editor to update story details
- **auto-proceed** - Claude makes reasonable assumptions and proceeds

## Auto Mode

Use `--auto-clarify` to automatically proceed with reasonable assumptions.

```bash
./ralph.elv --auto-clarify
./ralph.elv --yolo  # Includes this flag
```

## Related Story Updates

When completing a story, Ralph may identify related stories (via tags) that should be updated based on what was implemented.

Use `--auto-update-related` to automatically apply suggested updates.

```bash
./ralph.elv --auto-update-related
./ralph.elv --yolo  # Includes this flag
```
