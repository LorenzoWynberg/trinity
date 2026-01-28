import { promises as fs } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const TASKS_FILE = path.join(process.cwd(), 'tasks.json')

export type TaskType = 'refine' | 'generate' | 'story-edit'
export type TaskStatus = 'queued' | 'running' | 'complete' | 'failed'

export interface Task {
  id: string
  type: TaskType
  status: TaskStatus
  version: string
  params: Record<string, any>
  createdAt: string
  startedAt?: string
  completedAt?: string
  result?: any
  error?: string
}

export interface TaskStore {
  current: string | null
  queue: string[]
  tasks: Record<string, Task>
}

// File lock to prevent concurrent writes
let lockPromise: Promise<void> | null = null

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  while (lockPromise) {
    await lockPromise
  }

  let resolve: () => void
  lockPromise = new Promise(r => { resolve = r })

  try {
    return await fn()
  } finally {
    lockPromise = null
    resolve!()
  }
}

async function readStore(): Promise<TaskStore> {
  try {
    const data = await fs.readFile(TASKS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return { current: null, queue: [], tasks: {} }
  }
}

async function writeStore(store: TaskStore): Promise<void> {
  await fs.writeFile(TASKS_FILE, JSON.stringify(store, null, 2))
}

export async function createTask(
  type: TaskType,
  version: string,
  params: Record<string, any> = {}
): Promise<Task> {
  return withLock(async () => {
    const store = await readStore()

    const task: Task = {
      id: uuidv4(),
      type,
      status: 'queued',
      version,
      params,
      createdAt: new Date().toISOString(),
    }

    store.tasks[task.id] = task
    store.queue.push(task.id)

    await writeStore(store)

    // Trigger worker to process queue
    processQueue().catch(console.error)

    return task
  })
}

export async function getTask(id: string): Promise<Task | null> {
  const store = await readStore()
  return store.tasks[id] || null
}

export async function getTasks(options: {
  type?: TaskType
  status?: TaskStatus | TaskStatus[]
  limit?: number
} = {}): Promise<Task[]> {
  const store = await readStore()
  let tasks = Object.values(store.tasks)

  if (options.type) {
    tasks = tasks.filter(t => t.type === options.type)
  }

  if (options.status) {
    const statuses = Array.isArray(options.status) ? options.status : [options.status]
    tasks = tasks.filter(t => statuses.includes(t.status))
  }

  // Sort by createdAt descending
  tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  if (options.limit) {
    tasks = tasks.slice(0, options.limit)
  }

  return tasks
}

export async function getActiveTasks(): Promise<Task[]> {
  return getTasks({ status: ['queued', 'running'] })
}

export async function getTasksByType(type: TaskType): Promise<Task[]> {
  return getTasks({ type, status: ['queued', 'running'] })
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
  return withLock(async () => {
    const store = await readStore()
    const task = store.tasks[id]

    if (!task) return null

    Object.assign(task, updates)
    await writeStore(store)

    return task
  })
}

export async function completeTask(id: string, result: any): Promise<Task | null> {
  return withLock(async () => {
    const store = await readStore()
    const task = store.tasks[id]

    if (!task) return null

    task.status = 'complete'
    task.completedAt = new Date().toISOString()
    task.result = result

    // Remove from current
    if (store.current === id) {
      store.current = null
    }

    await writeStore(store)

    // Process next in queue
    processQueue().catch(console.error)

    return task
  })
}

export async function failTask(id: string, error: string): Promise<Task | null> {
  return withLock(async () => {
    const store = await readStore()
    const task = store.tasks[id]

    if (!task) return null

    task.status = 'failed'
    task.completedAt = new Date().toISOString()
    task.error = error

    // Remove from current
    if (store.current === id) {
      store.current = null
    }

    await writeStore(store)

    // Process next in queue
    processQueue().catch(console.error)

    return task
  })
}

// Worker to process queue
let processing = false

async function processQueue(): Promise<void> {
  if (processing) return
  processing = true

  try {
    const store = await readStore()

    // If something is already running, wait
    if (store.current) {
      processing = false
      return
    }

    // Get next from queue
    const nextId = store.queue.shift()
    if (!nextId) {
      processing = false
      return
    }

    const task = store.tasks[nextId]
    if (!task) {
      processing = false
      return processQueue() // Try next
    }

    // Mark as running
    await withLock(async () => {
      const s = await readStore()
      s.current = nextId
      s.queue = s.queue.filter(id => id !== nextId)
      s.tasks[nextId].status = 'running'
      s.tasks[nextId].startedAt = new Date().toISOString()
      await writeStore(s)
    })

    // Execute task (this happens async)
    executeTask(task).catch(console.error)

  } finally {
    processing = false
  }
}

// Task execution - calls the appropriate handler
async function executeTask(task: Task): Promise<void> {
  const { runRefineTask } = await import('./task-handlers')
  const { runGenerateTask } = await import('./task-handlers')
  const { runStoryEditTask } = await import('./task-handlers')

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
      default:
        throw new Error(`Unknown task type: ${task.type}`)
    }

    await completeTask(task.id, result)
  } catch (error: any) {
    await failTask(task.id, error.message || 'Unknown error')
  }
}

// Cleanup old tasks (keep last 50)
export async function cleanupTasks(): Promise<void> {
  return withLock(async () => {
    const store = await readStore()
    const tasks = Object.values(store.tasks)

    // Sort by createdAt descending
    tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Keep only completed/failed tasks beyond 50
    const toKeep = new Set<string>()
    let completedCount = 0

    for (const task of tasks) {
      if (task.status === 'queued' || task.status === 'running') {
        toKeep.add(task.id)
      } else {
        completedCount++
        if (completedCount <= 50) {
          toKeep.add(task.id)
        }
      }
    }

    // Remove old tasks
    for (const id of Object.keys(store.tasks)) {
      if (!toKeep.has(id)) {
        delete store.tasks[id]
      }
    }

    await writeStore(store)
  })
}
