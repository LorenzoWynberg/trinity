'use client'

import { createContext, useContext, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useTaskStore, type Task, type TaskType, type TaskContext } from '@/lib/task-store'

export type { Task, TaskType, TaskContext }
export type { TaskStatus } from '@/lib/task-store'

interface TaskContextValue {
  // From store
  activeTasks: Task[]
  unreadTasks: Task[]
  unseenCount: number
  isTaskRunning: (type: TaskType) => boolean
  getActiveTask: (type: TaskType) => Task | undefined

  // Actions
  createTask: (type: TaskType, version: string, params?: Record<string, any>, context?: TaskContext) => Promise<Task>
  refreshTasks: () => Promise<void>
}

const TaskContext = createContext<TaskContextValue | null>(null)

export function useTaskContext() {
  const context = useContext(TaskContext)
  if (!context) {
    throw new Error('useTaskContext must be used within TaskProvider')
  }
  return context
}

// Hook for checking if a specific task type is running
export function useTaskLoading(type: TaskType): boolean {
  const store = useTaskStore()
  return store.isTaskRunning(type)
}

interface TaskProviderProps {
  children: React.ReactNode
}

export function TaskProvider({ children }: TaskProviderProps) {
  const { toast } = useToast()
  const previousActiveIdsRef = useRef<Set<string>>(new Set())
  const notificationPermissionRef = useRef<NotificationPermission>('default')

  // Task store
  const store = useTaskStore()
  const {
    setTasks,
    addPendingTask,
    getActiveTasks,
    getUnreadTasks,
    getUnseenCount,
    isTaskRunning,
  } = store

  const activeTasks = getActiveTasks()
  const unreadTasks = getUnreadTasks()
  const unseenCount = getUnseenCount()

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then(permission => {
        notificationPermissionRef.current = permission
      })
    }
  }, [])

  const navigateToTask = useCallback((task: Task) => {
    const returnPath = task.context?.returnPath || '/stories'

    if (returnPath) {
      addPendingTask(task)
      window.location.href = returnPath
    }
  }, [addPendingTask])

  const showNotification = useCallback((task: Task) => {
    const title = task.status === 'complete'
      ? `${task.type === 'refine' ? 'Refine' : task.type === 'generate' ? 'Generate' : 'Story Edit'} Complete`
      : `Task Failed`

    const body = task.status === 'complete'
      ? task.type === 'refine'
        ? `${task.result?.refinements?.filter((r: any) => r.status === 'needs_work').length || 0} stories need work`
        : task.type === 'generate'
        ? `${task.result?.stories?.length || 0} stories generated`
        : 'Story analysis complete'
      : task.error || 'An error occurred'

    // Toast notification
    toast({
      title,
      description: body,
      variant: task.status === 'complete' ? 'default' : 'destructive',
      action: task.status === 'complete' ? (
        <button
          onClick={() => navigateToTask(task)}
          className="text-xs underline"
        >
          View Results
        </button>
      ) : undefined
    })

    // Browser notification
    if (notificationPermissionRef.current === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: task.id
      })

      notification.onclick = () => {
        window.focus()
        navigateToTask(task)
        notification.close()
      }
    }
  }, [toast, navigateToTask])

  const refreshTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks?limit=50')
      const data = await res.json()
      const newTasks: Task[] = data.tasks || []
      const unreadCount: number = data.unreadCount || 0

      // Check for newly completed tasks
      const newActiveIds = new Set<string>(
        newTasks.filter(t => t.status === 'queued' || t.status === 'running').map(t => t.id)
      )
      const previousActiveIds = previousActiveIdsRef.current

      // Find tasks that were active but are no longer
      for (const prevId of previousActiveIds) {
        if (!newActiveIds.has(prevId)) {
          const completedTask = newTasks.find(t => t.id === prevId)
          if (completedTask && !completedTask.read_at) {
            showNotification(completedTask)
          }
        }
      }

      previousActiveIdsRef.current = newActiveIds
      setTasks(newTasks, unreadCount)
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    }
  }, [showNotification, setTasks])

  // Poll for task updates
  useEffect(() => {
    refreshTasks()
    const interval = setInterval(refreshTasks, 2000)
    return () => clearInterval(interval)
  }, [refreshTasks])

  const getActiveTask = useCallback((type: TaskType): Task | undefined => {
    return activeTasks.find(t => t.type === type)
  }, [activeTasks])

  const createTask = useCallback(async (
    type: TaskType,
    version: string,
    params: Record<string, any> = {},
    context?: TaskContext
  ): Promise<Task> => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, version, params, context })
    })

    const data = await res.json()

    if (data.error) {
      throw new Error(data.error)
    }

    // Refresh to pick up new task
    await refreshTasks()

    toast({
      title: 'Task Started',
      description: `${type === 'refine' ? 'Refine' : type === 'generate' ? 'Generate' : 'Story Edit'} task queued for ${version}`
    })

    return data.task
  }, [refreshTasks, toast])

  return (
    <TaskContext.Provider value={{
      activeTasks,
      unreadTasks,
      unseenCount,
      isTaskRunning,
      getActiveTask,
      createTask,
      refreshTasks,
    }}>
      {children}
    </TaskContext.Provider>
  )
}
