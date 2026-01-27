# Ralph Dashboard

Architecture and features of the Ralph Dashboard.

## Overview

The dashboard is a Next.js app for viewing PRD status, running Ralph, and managing the development loop.

**Location:** `tools/ralph/dashboard/`

## Terminology

- **Passed** = Claude finished the work (not "completed")
- **Merged** = PR merged to base branch

## Pages

### Stories Page
- Lists all stories grouped by phase/epic
- Blocked stories show only "first generation" blocked - stories whose blocker is NOT itself blocked
- Version filtering via URL param: `?version=v1.0`
- Phases are per-version

### Graph Page
- Dependency visualization using ReactFlow
- Version filtering, multiple layouts, custom saved layouts
- See [Graph](graph.md) for details

### Story Detail Page (`/stories/[id]`)
- Full story view with intent, description, acceptance criteria
- Dependency links (what this story depends on)
- Dependent links (what depends on this story)
- PR URL and merge commit tracking
- Edit button to modify story

### Terminal Page
- Interactive terminal for running Ralph from the dashboard
- Full PTY support enables interactive programs like `claude`
- See [Terminal](terminal.md) for details

### Metrics Page
- Token usage and cost tracking
- Duration statistics

### Activity Page
- Daily activity logs
- Split by project (trinity/ralph)

### Knowledge/Gotchas Pages
- Same book/chapter structure for both
- Book selector dropdown + chapter dropdown (hidden if only one chapter)
- URL params: `?book=ralph&chapter=cli-reference`
- Markdown rendering with syntax highlighting

### Settings Page
- **Theme selection:** light, dark, cyber-light, cyber-dark, system
- **Default version:** Which PRD version to show by default
- Settings persisted via `/api/settings` to `settings.json`
