# PRD Tools

Three Claude-powered PRD editing flows on the Stories page.

## Story Edit

Accessed via pencil icon on story modal, or "Edit Story" button on detail page.

**Flow:** Input → Review → Complete

- Describe changes, Claude suggests updated acceptance criteria
- Finds related stories (tag overlap >=2 or dependency relationship)
- Inline edit suggestions before applying

**API:** `POST/PUT /api/prd/story`

## Refine Stories

Accessed via "Refine" button in Stories header.

**Flow:** Analyze → Review → Complete

- Claude reviews all pending stories for clarity issues
- Suggests improved acceptance criteria
- Inline edit suggestions before applying

**API:** `POST/PUT /api/prd/refine`

## Generate Stories

Accessed via "Generate" button in Stories header.

**Flow:** Input → Review → Complete

- Describe feature in natural language
- Claude generates formatted stories with phase, epic, tags, acceptance
- Inline edit all fields before adding

**API:** `POST/PUT /api/prd/generate`

## Inline Editing Pattern

All three wizards support inline editing of suggestions:

- Pencil icon on each card expands edit mode
- Acceptance criteria: one per line in textarea
- Check to save, X to cancel
- Selection state persists through edit
