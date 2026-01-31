# Feedback on {{CURRENT_STORY}}

**Context:** Version {{VERSION}} | Branch: {{BRANCH}} | Attempt: {{ATTEMPT}}

## Original Task
{{ORIGINAL_TASK}}

## Feedback
The user has reviewed your work and requested changes:

> {{FEEDBACK}}

## Workflow

Create tasks to track your response to this feedback:

| # | Task Subject | Done When |
|---|--------------|-----------|
| 1 | Understand feedback | You know what needs to change |
| 2 | Make changes | Changes implemented |
| 3 | Verify | Build passes, tests pass |
| 4 | Commit & signal | signal.json written |

## Guidelines

**Do:**
- Review `git log --oneline -10` and `git diff dev...HEAD` to see current state
- Focus only on what the feedback mentions
- Run verification: `go work sync && go build ./cli/cmd/trinity && go test ./...`

**Don't:**
- Refactor unrelated code
- Add features not requested
- Change things not mentioned in feedback

## Signal

When done, write `tools/ralph/cli/signal.json`:
```json
{
  "status": "complete",
  "story_id": "{{CURRENT_STORY}}",
  "files_changed": ["list", "of", "files"],
  "tests_passed": true,
  "message": null
}
```
