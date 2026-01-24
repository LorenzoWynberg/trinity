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
- [x] Initialize Next.js 14 project with TypeScript
- [x] Configure Tailwind CSS
- [x] Install shadcn/ui CLI
- [x] Add base shadcn components (button, card, badge, table, tabs)
- [x] Set up project structure (app/, components/, lib/)

### Layout & Navigation
- [x] Create root layout with sidebar
- [x] Build sidebar component with navigation links
- [x] Add Lucide icons
- [ ] Implement dark mode toggle
- [ ] Create responsive mobile menu

### Data Layer
- [x] Create TypeScript types for PRD, metrics, state
- [x] Implement `getPRD()` - read prd.json
- [x] Implement `getMetrics()` - read metrics.json
- [x] Implement `getState()` - read state.json
- [x] Implement `getActivityLogs()` - parse activity markdown
- [x] Implement `getLearnings()` - parse learnings markdown

---

## Phase 2: Core Pages

### Dashboard Home (`/`)
- [x] Stats cards row (total stories, merged, tokens, time)
- [x] Phase progress bars
- [x] Current work card (from state.json)
- [ ] Recent activity feed (last 5 entries)

### Stories List (`/stories`)
- [x] Story card component
- [x] List view with all stories
- [x] Filter by status (pending, in_progress, passed, merged, skipped)
- [x] Filter by phase
- [ ] Filter by epic
- [ ] Search stories by title/ID
- [ ] Sort options (ID, status, phase)

### Story Detail (`/stories/[id]`)
- [x] Story header with title and status badge
- [x] Acceptance criteria list
- [x] Dependencies section with links
- [x] Blocked-by / Blocks relationships
- [x] Branch and PR info
- [ ] Story activity history

---

## Phase 3: Visualization

### Metrics Page (`/metrics`)
- [ ] Install Recharts
- [ ] Token usage over time (line chart)
- [ ] Time per story (bar chart)
- [ ] Stories completed per day (area chart)
- [x] Metrics table with all recorded data
- [x] Summary stats cards

### Activity Page (`/activity`)
- [x] Activity log list component
- [x] Date picker for filtering (tabs)
- [ ] Search within logs
- [x] Markdown rendering for log content
- [ ] Auto-scroll to latest

### Learnings Page (`/learnings`)
- [x] Learnings card component
- [x] Category tabs (gotchas, patterns, conventions)
- [x] Markdown rendering with syntax highlighting
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
- [x] Empty states for no data
- [ ] Keyboard navigation (j/k for lists)
- [ ] Breadcrumb navigation

### Auto-Refresh
- [x] Implement polling for state.json (5s revalidation)
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

- Using Next.js 14 App Router with server components
- 5-second revalidation for auto-refresh on all pages
- Reading files directly from scripts/ralph/ and docs/

---

## Completed

### 2026-01-24
- Phase 1 Foundation complete
- Phase 2 Core Pages complete (basic versions)
- Phase 3 started (metrics table, activity/learnings viewers)
