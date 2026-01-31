# PRD Tools

Three Claude-powered PRD editing flows on the Stories page. All modifications go through Claude - the dashboard never writes to PRD files directly.

## Architecture

```
Dashboard Modal
    ↓ API request
API Route
    ↓ writes prompt to /tmp/claude-prompt-{uuid}.md
    ↓ claude --print < prompt-file
Claude CLI
    ↓ writes response to /tmp/claude-response-{uuid}.json
API Route
    ↓ reads response, returns to frontend
Dashboard Modal
```

**Key benefit:** No shell escaping issues, no size limits, reliable JSON parsing.

## Refine Stories

Accessed via "Refine" button in Stories header.

**Flow:** Analyze → Review (iterate) → Apply

1. Claude analyzes all pending stories for clarity issues
2. For each story, Claude suggests:
   - `suggested_description` - improved description
   - `suggested_acceptance` - clearer criteria
   - `issues` - what's wrong with current version
3. User reviews suggestions
4. **Iterative refinement:** Click pencil icon → type feedback → Claude regenerates suggestions for that story only
5. Repeat until happy
6. Click "Apply" → Claude writes both description and acceptance to PRD

**API:**
- `POST /api/prd/refine` - Analyze all pending stories
- `POST /api/prd/refine/edit` - Regenerate suggestions for single story
- `PUT /api/prd/refine` - Apply selected refinements to PRD

## Generate Stories

Accessed via "Generate" button in Stories header.

**Flow:** Input → Review → Apply

1. Describe feature in natural language
2. Claude generates formatted stories with:
   - phase, epic assignment
   - proper dependencies
   - tags
   - specific acceptance criteria
3. Review and select which to add
4. Click "Add" → Claude writes stories to PRD with auto-generated IDs

**API:**
- `POST /api/prd/generate` - Generate stories from description
- `PUT /api/prd/generate` - Add selected stories to PRD

## Story Edit

Accessed via pencil icon on story modal, or "Edit Story" button on detail page.

**Flow:** Input → Review (with previews) → Apply

1. Describe changes you want
2. Claude suggests:
   - `suggested_description` - improved description
   - `suggested_acceptance` - updated criteria
   - `suggested_intent` - updated intent (if needed)
3. Finds related stories (tag overlap ≥2 or dependency relationship)
4. **Review rows** show summary for each update:
   - Story ID and title
   - "X criteria • description updated" summary
   - Preview button to see full details
5. **Preview modal** shows full suggested content:
   - Suggested description in highlighted box
   - Numbered acceptance criteria
   - Reason for update (for related stories)
   - Iterate section to regenerate with feedback
6. Select which updates to apply
7. Click "Apply" → Claude writes to PRD

**API:**
- `POST /api/prd/story` - Analyze requested changes, find related stories
- `PUT /api/prd/story` - Apply updates to PRD

## AI-Assisted Iteration

Both Refine and Story Edit support iterative refinement:

**In Refine modal:**
1. Click pencil on any refinement card
2. Type feedback in prompt input
3. Claude regenerates suggestions for that story
4. If changes affect related stories, those update too

**In Story Edit preview modal:**
1. Click Preview on any suggested update
2. See full description + acceptance criteria
3. Type feedback in "Want changes?" textarea
4. Click Regenerate → Claude refines suggestions
5. Preview updates in place
6. Related stories update if cascading changes detected

This keeps humans in the loop while letting AI do the heavy lifting.

## Background Tasks

All three PRD tools support background task execution. Users can start a task and continue working - they'll be notified when it completes.

**Flow:**
1. User clicks "Start" in modal
2. Task queued in database, modal shows "running" state
3. User can close modal and continue working
4. Task completes, toast + browser notification appears
5. User clicks notification → navigates back to modal with results

See `docs/knowledge/ralph-dashboard/tasks.md` for full background task architecture.

## Timeouts

All Claude CLI operations use a **15 minute default timeout** (configured in `runClaude()` in `src/lib/claude.ts`).

**Gotcha:** The refine endpoint analyzes ALL pending stories in a single Claude call. With 90+ stories, this can take several minutes. If you see SIGTERM/killed errors with "no output", the timeout may need increasing.

Debug logging is available - check terminal for `[runClaude]` and `[refine]` prefixed logs showing request details and error info (exit code, signal, killed status).
