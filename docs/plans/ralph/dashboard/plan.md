# Ralph Dashboard

A Next.js web interface for visualizing PRD progress, metrics, and activity.

## Overview

A local dashboard that reads Ralph's data files and presents them in a beautiful, interactive UI. Runs alongside Ralph to give visibility into the autonomous development loop.

## Tech Stack

- **Next.js 14** - App router, server components
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautiful, accessible components
- **Lucide Icons** - Icon library
- **Recharts** - Charts for metrics visualization

## Directory Structure

```
tools/ralph/dashboard/
├── app/
│   ├── layout.tsx          # Root layout with sidebar
│   ├── page.tsx            # Dashboard home (overview)
│   ├── stories/
│   │   ├── page.tsx        # All stories list/kanban
│   │   └── [id]/page.tsx   # Story detail view
│   ├── metrics/
│   │   └── page.tsx        # Metrics & charts
│   ├── activity/
│   │   └── page.tsx        # Activity log viewer
│   └── learnings/
│       └── page.tsx        # Learnings browser
├── components/
│   ├── ui/                 # shadcn components
│   ├── sidebar.tsx         # Navigation sidebar
│   ├── story-card.tsx      # Story card component
│   ├── progress-ring.tsx   # Circular progress
│   ├── dependency-graph.tsx # D3 dependency visualization
│   ├── metrics-chart.tsx   # Token/time charts
│   └── activity-feed.tsx   # Live activity stream
├── lib/
│   ├── data.ts             # Read PRD, metrics, state files
│   ├── types.ts            # TypeScript types
│   └── utils.ts            # Helpers
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.js
```

## Pages

### 1. Dashboard Home (`/`)

Overview with key stats at a glance:

```
┌─────────────────────────────────────────────────────────┐
│  RALPH DASHBOARD                              [refresh] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Stories  │  │ Merged   │  │ Tokens   │  │  Time   │ │
│  │   47     │  │   12     │  │  245K    │  │  4.2h   │ │
│  │  total   │  │  (25%)   │  │  used    │  │  total  │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                         │
│  Phase Progress                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Phase 1: MVP        ████████████░░░░░  75%     │   │
│  │ Phase 2: Growth     ██░░░░░░░░░░░░░░░  10%     │   │
│  │ Phase 3: Scale      ░░░░░░░░░░░░░░░░░   0%     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Current Work                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ● STORY-1.2.4: Add user authentication          │   │
│  │   Branch: feat/story-1.2.4                      │   │
│  │   Status: in_progress | Attempt: 2              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Recent Activity                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 12:34  Story STORY-1.2.3 completed              │   │
│  │ 12:30  PR #24 merged                            │   │
│  │ 12:15  Starting STORY-1.2.4                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2. Stories (`/stories`)

Kanban or list view of all stories:

**Views:**
- **Kanban** - columns: Pending, In Progress, Passed, Merged, Skipped
- **List** - sortable table with filters
- **Tree** - hierarchical phase → epic → story

**Filters:**
- By phase
- By epic
- By status
- By tags

**Story Card:**
```
┌─────────────────────────────────────┐
│ STORY-1.2.3                    [✓] │
│ Add login form validation          │
├─────────────────────────────────────┤
│ Epic: Auth  •  Phase: MVP          │
│ Deps: STORY-1.2.1, STORY-1.2.2     │
├─────────────────────────────────────┤
│ ○ Form validates email format      │
│ ○ Shows inline error messages      │
│ ○ Disables submit until valid      │
└─────────────────────────────────────┘
```

### 3. Story Detail (`/stories/[id]`)

Full story information:

- Title, intent, acceptance criteria
- Status badges
- Dependencies (with links)
- Blocked-by / Blocks relationships
- Branch name, PR link
- Activity history for this story
- Git diff preview

### 4. Metrics (`/metrics`)

Charts and statistics:

- **Token usage over time** - line chart
- **Time per story** - bar chart
- **Completion rate** - stories/day
- **Cost estimate** - based on token pricing
- **Table** - all recorded metrics with sorting

### 5. Activity (`/activity`)

Activity log viewer:

- Parse `docs/activity/*.md` files
- Filter by date range
- Search within logs
- Highlight current story entries
- Auto-refresh option

### 6. Learnings (`/learnings`)

Knowledge base browser:

- Render `docs/learnings/*.md` files
- Categorized by file (gotchas, patterns, conventions)
- Search across all learnings
- Syntax highlighting for code blocks

## Components

### Sidebar
```tsx
- Dashboard (home icon)
- Stories (list icon)
- Metrics (chart icon)
- Activity (clock icon)
- Learnings (book icon)
---
- Settings (gear icon)
```

### Progress Ring
Circular progress indicator for phase/epic completion.

### Dependency Graph
Interactive D3 visualization showing story dependencies. Click to navigate.

### Story Status Badge
Color-coded badges: pending (gray), in_progress (blue), passed (yellow), merged (green), skipped (purple), blocked (red).

## Data Loading

Read files from disk using Next.js server components:

```typescript
// lib/data.ts
import fs from 'fs/promises'
import path from 'path'

const RALPH_DIR = path.join(process.cwd(), '..')

export async function getPRD() {
  const content = await fs.readFile(
    path.join(RALPH_DIR, 'prd.json'),
    'utf-8'
  )
  return JSON.parse(content)
}

export async function getMetrics() {
  const content = await fs.readFile(
    path.join(RALPH_DIR, 'metrics.json'),
    'utf-8'
  )
  return JSON.parse(content)
}

export async function getState() {
  const content = await fs.readFile(
    path.join(RALPH_DIR, 'state.json'),
    'utf-8'
  )
  return JSON.parse(content)
}

export async function getActivityLogs() {
  const activityDir = path.join(RALPH_DIR, '../../docs/activity')
  const files = await fs.readdir(activityDir)
  // Parse markdown files...
}
```

## Auto-Refresh

Use Next.js revalidation or client-side polling:

```typescript
// Option 1: Revalidate on interval
export const revalidate = 5 // seconds

// Option 2: Client polling with SWR
const { data } = useSWR('/api/state', fetcher, {
  refreshInterval: 5000
})
```

## Implementation Phases

### Phase 1: Foundation
- [ ] Initialize Next.js project with TypeScript
- [ ] Install and configure Tailwind CSS
- [ ] Install shadcn/ui, add base components
- [ ] Create app layout with sidebar
- [ ] Set up data loading utilities

### Phase 2: Core Pages
- [ ] Dashboard home with stats cards
- [ ] Stories list view with filters
- [ ] Story detail page
- [ ] Basic progress indicators

### Phase 3: Visualization
- [ ] Metrics page with charts
- [ ] Activity log viewer
- [ ] Learnings browser
- [ ] Dependency graph visualization

### Phase 4: Polish
- [ ] Dark mode toggle
- [ ] Auto-refresh functionality
- [ ] Responsive design
- [ ] Loading states and error handling
- [ ] Keyboard navigation

## Running the Dashboard

```bash
cd tools/ralph/web
npm install
npm run dev
# Open http://localhost:3000
```

## Notes

- Dashboard is read-only - doesn't modify Ralph files
- Designed for local development use
- Could later add WebSocket for real-time updates
- Could later add API endpoints for remote access
