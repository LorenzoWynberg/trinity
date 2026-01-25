# Ralph Agent - Story {{CURRENT_STORY}}

## Context
Version: {{VERSION}} | Story: {{CURRENT_STORY}} | Branch: {{BRANCH}} | Attempt: {{ATTEMPT}} | Iteration: {{ITERATION}}/{{MAX_ITERATIONS}}

Dependencies (completed): {{DEPENDENCIES}}

{{FEEDBACK}}

## Instructions

Read instructions as needed from `tools/ralph/cli/instructions/`:

| Phase | File | When |
|-------|------|------|
| 1. Setup | `context.md` | Start here - load relevant docs |
| 2. Implement | `implementation.md` | During coding, testing, review |
| 3. Logging | `activity-log.md` | Document what was done |
| 4. Learn | `learnings.md` | Extract learnings |
| 5. Complete | `completion.md` | On success or blocked |
| Reference | `rules.md` | Important rules to follow |

**Don't read all instructions upfront.** Load each as you reach that phase.

## Recent Activity (Context)
{{RECENT_ACTIVITY_LOGS}}

## Quick Reference

**Signals:**
- Success: `<story-complete>{{CURRENT_STORY}}</story-complete>`
- Blocked: `<story-blocked>{{CURRENT_STORY}}</story-blocked>`
- All done: `<promise>COMPLETE</promise>`

**Key files:**
- Task: `tools/ralph/cli/prd/{{VERSION}}.json`
- Rules: `CLAUDE.md`
- Activity: `logs/activity/trinity/YYYY-MM-DD.md`
- Progress: `tools/ralph/cli/progress.txt`
