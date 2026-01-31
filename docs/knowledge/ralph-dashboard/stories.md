# Stories

The stories page lists all PRD stories grouped by phase and epic.

## Features

- Stories grouped by phase/epic hierarchy
- Version filtering via URL param: `?version=v1.0`
- Phases are scoped per version

## Blocked Stories

Blocked stories show only "first generation" blocked - stories whose blocker is NOT itself blocked. This prevents cascading blocked indicators that would clutter the view.

## Story Detail Page

Click any story to view `/stories/[id]`:

- Full story view with intent, description, acceptance criteria
- Dependency links (what this story depends on)
- Dependent links (what depends on this story)
- PR URL and merge commit tracking
- Edit button to modify story

## Header Actions

- **Refine** - Open refine stories wizard (see [PRD Tools](prd-tools.md))
- **Generate** - Open generate stories wizard (see [PRD Tools](prd-tools.md))
