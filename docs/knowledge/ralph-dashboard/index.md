# Ralph Dashboard

The dashboard is a Next.js app for viewing PRD status, running Ralph, and managing the development loop.

**Location:** `tools/ralph/dashboard/`

## Terminology

- **Passed** = Claude finished the work (not "completed")
- **Merged** = PR merged to base branch

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
| [PRD Tools](prd-tools.md) | Claude-powered story editing wizards |
| [Database](database.md) | SQLite storage for tasks and settings |
| [Themes](themes.md) | Light, dark, and cyber themes |

## Running Locally

```bash
npm run dev           # Next.js + WebSocket + ngrok
npm run dev:terminal  # WebSocket server only
npm run dev:next      # Next.js only
```
