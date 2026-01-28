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

**Flow:** Input → Review → Apply

1. Describe changes you want
2. Claude suggests updated acceptance criteria
3. Finds related stories (tag overlap ≥2 or dependency relationship)
4. Review and optionally edit suggestions
5. Apply to update PRD

**API:**
- `POST /api/prd/story` - Analyze requested changes
- `PUT /api/prd/story` - Apply updates to PRD

## AI-Assisted Editing

The pencil icon now prompts Claude instead of opening a manual textarea:

1. Click pencil → prompt input appears below suggestions
2. Type feedback: "be more specific about error handling"
3. Press Enter → Claude regenerates suggestions for that story
4. See updated suggestions in place
5. Repeat until satisfied

This keeps humans in the loop while letting AI do the heavy lifting.
