# Ralph Dashboard Checklist

Track implementation progress for the Next.js PRD dashboard.

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Complete
- [-] Skipped/Deferred

---

## Phase 1: Foundation

### Project Setup
- [ ] Initialize Next.js 14 project with TypeScript
- [ ] Configure Tailwind CSS
- [ ] Install shadcn/ui CLI
- [ ] Add base shadcn components (button, card, badge, table, tabs)
- [ ] Set up project structure (app/, components/, lib/)

### Layout & Navigation
- [ ] Create root layout with sidebar
- [ ] Build sidebar component with navigation links
- [ ] Add Lucide icons
- [ ] Implement dark mode toggle
- [ ] Create responsive mobile menu

### Data Layer
- [ ] Create TypeScript types for PRD, metrics, state
- [ ] Implement `getPRD()` - read prd.json
- [ ] Implement `getMetrics()` - read metrics.json
- [ ] Implement `getState()` - read state.json
- [ ] Implement `getActivityLogs()` - parse activity markdown
- [ ] Implement `getLearnings()` - parse learnings markdown

---

## Phase 2: Core Pages

### Dashboard Home (`/`)
- [ ] Stats cards row (total stories, merged, tokens, time)
- [ ] Phase progress bars
- [ ] Current work card (from state.json)
- [ ] Recent activity feed (last 5 entries)

### Stories List (`/stories`)
- [ ] Story card component
- [ ] List view with all stories
- [ ] Filter by status (pending, in_progress, passed, merged, skipped)
- [ ] Filter by phase
- [ ] Filter by epic
- [ ] Search stories by title/ID
- [ ] Sort options (ID, status, phase)

### Story Detail (`/stories/[id]`)
- [ ] Story header with title and status badge
- [ ] Acceptance criteria list
- [ ] Dependencies section with links
- [ ] Blocked-by / Blocks relationships
- [ ] Branch and PR info
- [ ] Story activity history

---

## Phase 3: Visualization

### Metrics Page (`/metrics`)
- [ ] Install Recharts
- [ ] Token usage over time (line chart)
- [ ] Time per story (bar chart)
- [ ] Stories completed per day (area chart)
- [ ] Metrics table with all recorded data
- [ ] Summary stats cards

### Activity Page (`/activity`)
- [ ] Activity log list component
- [ ] Date picker for filtering
- [ ] Search within logs
- [ ] Markdown rendering for log content
- [ ] Auto-scroll to latest

### Learnings Page (`/learnings`)
- [ ] Learnings card component
- [ ] Category tabs (gotchas, patterns, conventions)
- [ ] Markdown rendering with syntax highlighting
- [ ] Search across all learnings

### Dependency Graph
- [ ] Install D3 or react-flow
- [ ] Story node component
- [ ] Dependency edge rendering
- [ ] Click to navigate to story
- [ ] Zoom and pan controls

---

## Phase 4: Polish

### UX Improvements
- [ ] Loading skeletons for all pages
- [ ] Error boundaries and error states
- [ ] Empty states for no data
- [ ] Keyboard navigation (j/k for lists)
- [ ] Breadcrumb navigation

### Auto-Refresh
- [ ] Implement polling for state.json
- [ ] Auto-refresh toggle in UI
- [ ] Visual indicator when data updates
- [ ] Configurable refresh interval

### Responsive Design
- [ ] Mobile-friendly sidebar (collapsible)
- [ ] Responsive stats cards
- [ ] Mobile story cards
- [ ] Touch-friendly interactions

### Final Polish
- [ ] Favicon and meta tags
- [ ] README with setup instructions
- [ ] npm scripts for dev/build
- [ ] Test on different browsers

---

## Stretch Goals (v2)

### Kanban View
- [ ] Drag-and-drop columns (view only, no state change)
- [ ] Column customization

### Real-time Updates
- [ ] File watcher backend
- [ ] WebSocket connection
- [ ] Live activity stream

### Export Features
- [ ] Export metrics as CSV
- [ ] Export PRD as markdown
- [ ] Print-friendly story view

---

## Notes

_Add implementation notes, blockers, or decisions here as you work._

---

## Completed

_Move completed items here with date for reference._
