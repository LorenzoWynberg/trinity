'use client'

import { createContext, useContext, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useDashboardStore, type Task, type TaskType } from '@/lib/store'

export type { Task, TaskType }
export type { TaskStatus } from '@/lib/store'

interface TaskContextValue {
  activeTasks: Task[]
  recentTasks: Task[]
  isTaskRunning: (type: TaskType) => boolean
  getActiveTask: (type: TaskType) => Task | undefined
  createTask: (type: TaskType, version: string, params?: Record<string, any>) => Promise<Task>
  refreshTasks: () => Promise<void>
  selectedTask: Task | null
  setSelectedTask: (task: Task | null) => void
  unseenCount: number
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
  const { isTaskRunning } = useTaskContext()
  return isTaskRunning(type)
}

interface TaskProviderProps {
  children: React.ReactNode
}

export function TaskProvider({ children }: TaskProviderProps) {
  const { toast } = useToast()
  const previousActiveIdsRef = useRef<Set<string>>(new Set())
  const notificationPermissionRef = useRef<NotificationPermission>('default')

  // Zustand store
  const {
    tasks,
    setTasks,
    seenTaskIds,
    markTaskSeen,
    selectedTaskId,
    setSelectedTaskId,
    getActiveTasks,
    getRecentTasks,
    getUnseenCount,
  } = useDashboardStore()

  const activeTasks = getActiveTasks()
  const recentTasks = getRecentTasks()
  const unseenCount = getUnseenCount()
  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then(permission => {
        notificationPermissionRef.current = permission
      })
    }
  }, [])

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
          onClick={() => setSelectedTaskId(task.id)}
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
        setSelectedTaskId(task.id)
        notification.close()
      }
    }
  }, [toast, setSelectedTaskId])

  const refreshTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks?limit=50')
      const data = await res.json()
      const newTasks: Task[] = data.tasks || []

      // Check for newly completed tasks
      const newActiveIds = new Set<string>(
        newTasks.filter(t => t.status === 'queued' || t.status === 'running').map(t => t.id)
      )
      const previousActiveIds = previousActiveIdsRef.current

      // Find tasks that were active but are no longer
      for (const prevId of previousActiveIds) {
        if (!newActiveIds.has(prevId)) {
          // Task completed - find it
          const completedTask = newTasks.find(t => t.id === prevId)
          if (completedTask && !seenTaskIds.has(completedTask.id)) {
            showNotification(completedTask)
          }
        }
      }

      previousActiveIdsRef.current = newActiveIds
      setTasks(newTasks)
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    }
  }, [showNotification, setTasks, seenTaskIds])

  // Poll for task updates
  useEffect(() => {
    refreshTasks()
    const interval = setInterval(refreshTasks, 2000)
    return () => clearInterval(interval)
  }, [refreshTasks])

  const isTaskRunning = useCallback((type: TaskType): boolean => {
    return activeTasks.some(t => t.type === type)
  }, [activeTasks])

  const getActiveTask = useCallback((type: TaskType): Task | undefined => {
    return activeTasks.find(t => t.type === type)
  }, [activeTasks])

  const createTask = useCallback(async (
    type: TaskType,
    version: string,
    params: Record<string, any> = {}
  ): Promise<Task> => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, version, params })
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

  const setSelectedTask = useCallback((task: Task | null) => {
    setSelectedTaskId(task?.id || null)
  }, [setSelectedTaskId])

  return (
    <TaskContext.Provider value={{
      activeTasks,
      recentTasks,
      isTaskRunning,
      getActiveTask,
      createTask,
      refreshTasks,
      selectedTask,
      setSelectedTask,
      unseenCount,
    }}>
      {children}
    </TaskContext.Provider>
  )
}
