# Background Tasks

The dashboard supports running Claude-powered operations as background tasks. Users can start a task and continue working - they'll be notified when it completes.

## Architecture

```
User clicks "Start"
    ↓
API creates task row (status: queued)
    ↓
Task runner picks up task (status: running)
    ↓
Claude executes (may take several minutes)
    ↓
Task completes (status: complete/failed)
    ↓
TaskProvider polls, detects completion
    ↓
Toast + browser notification
    ↓
User clicks notification → navigates to results modal
```

## Database Schema

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'refine' | 'generate' | 'story-edit'
  status TEXT NOT NULL,         -- 'queued' | 'running' | 'complete' | 'failed'
  version TEXT NOT NULL,
  params TEXT,                  -- JSON: task-specific parameters
  context TEXT,                 -- JSON: returnPath, step, formData, etc.
  result TEXT,                  -- JSON: Claude's response
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  read_at TEXT,                 -- When user viewed the result
  deleted_at TEXT               -- Soft delete timestamp
);
```

## Task Types

| Type | Description | Result Shape |
|------|-------------|--------------|
| `refine` | Analyze all pending stories for clarity issues | `{ refinements: [...], summary }` |
| `generate` | Generate stories from natural language description | `{ stories: [...], reasoning }` |
| `story-edit` | Analyze changes to a specific story and find related updates | `{ storyId, currentStory, target, related_updates, summary }` |

## Client-Side State

**Zustand store** (`src/lib/task-store.ts`):

```typescript
interface TaskStore {
  // Server-synced state
  tasks: Task[]
  unreadCount: number

  // Client-side navigation state
  pendingTasks: Task[]  // Tasks to show in modals after navigation

  // Actions
  setTasks: (tasks: Task[], unreadCount?: number) => void
  addPendingTask: (task: Task) => void
  removePendingTask: (taskId: string) => void

  // Getters
  getActiveTasks: () => Task[]    // queued or running
  getUnreadTasks: () => Task[]    // complete/failed, not read
  isTaskRunning: (type: TaskType) => boolean
}
```

**Persistence:** Only `pendingTasks` is persisted to localStorage. This survives page navigation so the modal can open on the target page.

## Task Flow

### Starting a Task

1. Modal calls `createTask(type, version, params, context)`
2. API creates task with `status: 'queued'`
3. Modal shows "task running" state with spinner
4. User can close modal and continue working

### Task Completion

1. `TaskProvider` polls `/api/tasks` every 2 seconds
2. Detects task moved from running → complete/failed
3. Shows toast notification with "View Results" action
4. Shows browser notification (if permission granted)

### Viewing Results

1. User clicks notification or task in dropdown
2. `addPendingTask(task)` stores full task data
3. Navigate to `returnPath` (from task context)
4. Target page's header component:
   - Subscribes to `pendingTasks` changes
   - Finds completed task by type
   - Opens appropriate modal with `initialTask` prop
   - Removes task from `pendingTasks`

## Task Indicator

The header shows a task indicator button with:
- Spinner when tasks are running
- Badge showing unread count
- Dropdown with running tasks and unread results
- Click result → navigate to modal

## Soft Deletes

Tasks support soft delete for better UX:
- `read_at` - timestamp when user viewed result
- `deleted_at` - timestamp when user dismissed task

API filters out deleted tasks by default. Tasks page has "Show Deleted" toggle.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks (with filters) |
| POST | `/api/tasks` | Create new task |
| PATCH | `/api/tasks/[id]` | Update task (read, delete, restore) |
| POST | `/api/tasks/clear` | Mark all unread as read |

## Gotchas

### Multiple Concurrent Tasks

The store supports multiple pending tasks via `pendingTasks` array. User can:
- Start a refine task
- While waiting, start a story-edit task
- Both complete independently
- Each opens its own modal when clicked

### Navigation + Modal Opening

The flow is:
1. Click task notification
2. Store task in `pendingTasks` (persisted)
3. Navigate via `window.location.href` (full page load)
4. Target component subscribes to store
5. Finds task, opens modal, removes from pending

Using `router.push()` didn't work reliably because React state was lost. Full page load + persisted store solved this.

### Store Subscription Pattern

Components that need to react to pending tasks should:

```typescript
useEffect(() => {
  const processPendingTasks = () => {
    const { pendingTasks, removePendingTask } = useTaskStore.getState()
    const task = pendingTasks.find(t => t.status === 'complete')
    if (task) {
      setActiveTask(task)
      setModalOpen(true)
      removePendingTask(task.id)
    }
  }

  processPendingTasks()  // Check immediately
  return useTaskStore.subscribe(processPendingTasks)
}, [])
```
