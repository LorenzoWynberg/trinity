# Dashboard

Architecture and features of the Ralph Dashboard.

## Overview

The dashboard is a Next.js app for viewing PRD status, running Ralph, and managing the development loop.

**Location:** `tools/ralph/dashboard/`

---

## Terminology

- **Passed** = Claude finished the work (not "completed")
- **Merged** = PR merged to base branch

---

## Pages

### Stories Page
- Lists all stories grouped by phase/epic
- Blocked stories show only "first generation" blocked - stories whose blocker is NOT itself blocked
- Version filtering via URL param: `?version=v1.0`
- Phases are per-version

### Graph Page
- Dependency visualization using ReactFlow
- Supports horizontal/vertical layouts
- Version filtering
- Fullscreen mode

### Terminal Page
- Interactive terminal for running Ralph from the dashboard
- Full PTY support enables interactive programs like `claude`

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

---

## Terminal Architecture

**Components:**
- `ws-server.js` - WebSocket server using node-pty for full PTY
- `terminal-view.tsx` - xterm.js client component

**Running locally:**
```bash
npm run dev        # Next.js + WebSocket + ngrok (if configured)
npm run dev:local  # Next.js + WebSocket only (no ngrok)
```

**Features:**
- Full PTY shell (zsh) - supports interactive programs
- Tab completion and command history work
- TUI apps like `claude` work properly
- Quick command buttons: Run, Stop, Status, Stats

**tmux persistence:** Sessions persist across page refresh, network disconnects, and browser restarts:
```javascript
// ws-server.js spawns tmux instead of raw shell
const ptyProcess = pty.spawn('tmux', ['new-session', '-A', '-s', 'ralph'], {
  // -A: attach if exists, create if not
  // -s: session name
})
```
Requires `brew install tmux`. Session named "ralph" persists until manually killed (`tmux kill-session -t ralph`).

---

## ngrok Setup (Remote Access)

For accessing dashboard from phone/remote:

**Config file:** `tools/ralph/dashboard/ngrok.yml` (gitignored - contains authtoken)

```yaml
version: 3
agent:
  authtoken: YOUR_TOKEN
tunnels:
  dashboard:
    addr: 4000
    proto: http
    domain: your-domain.ngrok.app  # Custom domain (no interstitial)
  terminal:
    addr: 4001
    proto: http  # Random URL (shows interstitial once)
```

**Key points:**
- Hobby plan ($10/mo): 3 endpoints, 1 custom domain
- Custom domain = no "Visit Site" interstitial page
- Random URLs still work but show interstitial
- Terminal WebSocket auto-detected via `/api/tunnels` endpoint
- Get authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
- Reserve domains at https://dashboard.ngrok.com/domains

---

## Themes

Four themes available: `light`, `dark`, `cyber-light`, `cyber-dark`

Cyber themes use pink/cyan neon accents. Graph page uses `resolvedTheme` to detect dark mode:
```tsx
const isDark = resolvedTheme === 'dark' || resolvedTheme === 'cyber-dark'
const isCyber = resolvedTheme === 'cyber-dark' || resolvedTheme === 'cyber-light'
```

**Cyber-dark graph colors:**
- Story nodes: Cyan backgrounds, purple text
- Version nodes: Yellow backgrounds, cyan text
- Use Tailwind custom variants: `cyber-dark:bg-cyan-900/80 cyber-dark:text-purple-200`

---

## PRD Tools (Wizard Modals)

Three Claude-powered PRD editing flows on the Stories page (no standalone page):

**1. Story Edit** (pencil icon on story modal, or "Edit Story" button on detail page)
- Input -> Review -> Complete
- Describe changes, Claude suggests updated acceptance criteria
- Finds related stories (tag overlap >=2 or dependency relationship)
- Inline edit suggestions before applying

**2. Refine Stories** (button in Stories header)
- Analyze -> Review -> Complete
- Claude reviews all pending stories for clarity issues
- Suggests improved acceptance criteria
- Inline edit suggestions before applying

**3. Generate Stories** (button in Stories header)
- Input -> Review -> Complete
- Describe feature in natural language
- Claude generates formatted stories with phase, epic, tags, acceptance
- Inline edit all fields before adding

**Inline editing pattern:**
- Pencil icon on each card expands edit mode
- Acceptance criteria: one per line in textarea
- Check to save, X to cancel
- Selection state persists through edit

**API endpoints:**
- `POST/PUT /api/prd/story` - Story edit
- `POST/PUT /api/prd/refine` - Refine stories
- `POST/PUT /api/prd/generate` - Generate stories

---

## Mobile Responsiveness

**Scrollable tabs:** Wrap TabsList for horizontal scroll on mobile:
```tsx
<div className="overflow-x-auto -mx-2 px-2 pb-2">
  <TabsList className="inline-flex w-max md:w-auto">
    {/* triggers */}
  </TabsList>
</div>
```

**Hamburger menu:** Use `mounted` state to avoid hydration mismatch:
```tsx
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])

{mounted && <MobileMenu />}  // Only render after hydration
```

**ReactFlow controls:** Position higher on mobile via CSS:
```css
@media (max-width: 768px) {
  .react-flow__controls { bottom: 80px !important; }
}
```

---

## Documentation Structure

Both Knowledge and Gotchas use the same book/chapter structure:

```
docs/<knowledge|gotchas>/<book>/
├── index.json           # Book metadata + page order
├── index.md             # Overview (required)
└── <chapter>.md         # Additional chapters (optional)
```

**Example (Ralph has multiple chapters):**
```
docs/knowledge/ralph/
├── index.json
├── index.md             # Overview
├── common-workflows.md  # Workflows
├── cli-reference.md     # CLI Reference
└── faq.md               # FAQ
```

**index.json schema:**
```json
{
  "title": "Ralph",
  "description": "Ralph CLI workflows and reference",
  "icon": "Terminal",
  "pages": [
    { "slug": "index", "title": "Overview" },
    { "slug": "cli-reference", "title": "CLI Reference" }
  ]
}
```

**Adding a chapter:**
1. Create `<chapter-slug>.md` in the book folder
2. Add entry to `index.json` pages array

**ChapterNav component (`src/components/chapter-nav.tsx`):**
- Book dropdown shows all books with icons from `index.json`
- Chapter dropdown only appears when book has multiple pages
- Same component used for both Knowledge and Gotchas
