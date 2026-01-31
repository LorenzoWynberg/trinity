# Ralph Dashboard

The dashboard is a Next.js app for viewing PRD status, running Ralph, and managing the development loop.

**Location:** `tools/ralph-dashboard/`

## Terminology

| Term | UI Label | Backend Field | Meaning |
|------|----------|---------------|---------|
| Passed | "Passed" (yellow) | `passes=true` | Claude finished work, PR created |
| Merged | "Completed" (green) | `merged=true` | PR merged to base branch |

**Note:** UI shows "Completed" for user-friendliness, but backend checks `merged` field.

## Pages

| Page | Description |
|------|-------------|
| [Stories](stories.md) | PRD stories grouped by phase/epic |
| [Graph](graph.md) | Dependency visualization |
| [Terminal](terminal.md) | Interactive shell for running Ralph |
| [Tasks](tasks.md) | Background task management |
| [Metrics](metrics.md) | Token usage and cost tracking |
| [Activity](activity.md) | Daily activity logs |
| [Knowledge & Gotchas](knowledge-gotchas.md) | Documentation viewer |
| [Settings](settings.md) | Theme and preferences |

## Features

| Feature | Description |
|---------|-------------|
| [Execution](execution.md) | Autonomous dev loop wizard |
| [Handoffs](handoffs.md) | Multi-agent pipeline coordination |
| [PRD Tools](prd-tools.md) | Claude-powered story editing wizards |
| [Database](database.md) | SQLite storage for PRD, tasks, handoffs |
| [Themes](themes.md) | Light, dark, and cyber themes |

## Running Locally

```bash
npm run dev           # Next.js + WebSocket + ngrok
npm run dev:terminal  # WebSocket server only
npm run dev:next      # Next.js only
```
