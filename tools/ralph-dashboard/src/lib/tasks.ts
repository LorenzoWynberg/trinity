import { tasks, type Task, type TaskType, type TaskStatus, type TaskContext } from './db'

export type { Task, TaskType, TaskStatus, TaskContext }

// Worker state
let processing = false

export async function createTask(
  type: TaskType,
  version: string,
  params: Record<string, any> = {},
  context?: TaskContext
): Promise<Task> {
  const task = tasks.create(type, version, params, context)

  // Trigger worker to process queue
  processQueue().catch(console.error)

  return task
}

export function getTask(id: string): Task | null {
  return tasks.get(id)
}

export function getTasks(options: {
  type?: TaskType
  status?: TaskStatus | TaskStatus[]
  limit?: number
  includeDeleted?: boolean
} = {}): Task[] {
  return tasks.list(options)
}

export function getActiveTasks(): Task[] {
  return tasks.getActive()
}

export function getTasksByType(type: TaskType): Task[] {
  return tasks.list({ type, status: ['queued', 'running'] })
}

export function completeTask(id: string, result: any): Task | null {
  const task = tasks.complete(id, result)

  // Process next in queue
  processQueue().catch(console.error)

  return task
}

export function failTask(id: string, error: string): Task | null {
  const task = tasks.fail(id, error)

  // Process next in queue
  processQueue().catch(console.error)

  return task
}

export function cleanupTasks(): number {
  return tasks.cleanup(50)
}

export function deleteTask(id: string): boolean {
  return tasks.delete(id)
}

export function markTaskRead(id: string): Task | null {
  return tasks.markRead(id)
}

export function markAllTasksRead(): number {
  return tasks.markAllRead()
}

export function softDeleteTask(id: string): Task | null {
  return tasks.softDelete(id)
}

export function restoreTask(id: string): Task | null {
  return tasks.restore(id)
}

export function getUnreadCount(): number {
  return tasks.getUnreadCount()
}

// Worker to process queue
async function processQueue(): Promise<void> {
  if (processing) return
  processing = true

  try {
    const next = tasks.getNext()
    if (!next) {
      processing = false
      return
    }

    // Mark as running
    tasks.start(next.id)

    // Execute task (this happens async)
    executeTask(next).catch(console.error)
  } finally {
    processing = false
  }
}

// Task execution - calls the appropriate handler
async function executeTask(task: Task): Promise<void> {
  const { runRefineTask, runGenerateTask, runStoryEditTask, runAlignTask } = await import('./task-handlers')

  try {
    let result: any

    switch (task.type) {
      case 'refine':
        result = await runRefineTask(task)
        break
      case 'generate':
        result = await runGenerateTask(task)
        break
      case 'story-edit':
        result = await runStoryEditTask(task)
        break
      case 'align':
        result = await runAlignTask(task)
        break
      default:
        throw new Error(`Unknown task type: ${task.type}`)
    }

    completeTask(task.id, result)
  } catch (error: any) {
    failTask(task.id, error.message || 'Unknown error')
  }
}
