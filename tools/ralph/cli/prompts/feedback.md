# Feedback on {{CURRENT_STORY}}

## Context
Version: {{VERSION}} | Story: {{CURRENT_STORY}} | Branch: {{BRANCH}} | Attempt: {{ATTEMPT}} | Iteration: {{ITERATION}}/{{MAX_ITERATIONS}}

Dependencies (completed): {{DEPENDENCIES}}

## Original Task
{{ORIGINAL_TASK}}

## What Was Done
Review the current state:
- Check `git log --oneline -10` to see recent commits on this branch
- Check `git diff dev...HEAD` to see all changes made
- Review the PR if one exists

## Feedback
The user has reviewed your work and requested the following changes:

> {{FEEDBACK}}

## Instructions
Address the feedback by making the necessary changes. Follow the same workflow as the original task:

1. **Understand the feedback** - What specifically needs to change?
2. **Make the changes** - Keep them focused on the feedback
3. **Verify** - Build and test your changes
4. **Self-review** - Does this address the feedback completely?
5. **Commit and push** - Use conventional commit format

Do NOT:
- Refactor unrelated code
- Add features not requested
- Change things that weren't mentioned in feedback

{{WORKFLOW}}

## 8. All Done?
If ALL stories in prd.json have `"merged": true`, output: `<promise>COMPLETE</promise>`
