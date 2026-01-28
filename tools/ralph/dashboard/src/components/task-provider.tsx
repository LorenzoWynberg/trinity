'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'

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

interface TaskContextValue {
  activeTasks: Task[]
  recentTasks: Task[]
  isTaskRunning: (type: TaskType) => boolean
  getActiveTask: (type: TaskType) => Task | undefined
  createTask: (type: TaskType, version: string, params?: Record<string, any>) => Promise<Task>
  refreshTasks: () => Promise<void>
  selectedTask: Task | null
  setSelectedTask: (task: Task | null) => void
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
  const [activeTasks, setActiveTasks] = useState<Task[]>([])
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const { toast } = useToast()
  const previousActiveIdsRef = useRef<Set<string>>(new Set())
  const notificationPermissionRef = useRef<NotificationPermission>('default')

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
          onClick={() => setSelectedTask(task)}
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
        setSelectedTask(task)
        notification.close()
      }
    }
  }, [toast])

  const refreshTasks = useCallback(async () => {
    try {
      const [activeRes, recentRes] = await Promise.all([
        fetch('/api/tasks?active=true'),
        fetch('/api/tasks?status=complete,failed&limit=10')
      ])

      const activeData = await activeRes.json()
      const recentData = await recentRes.json()

      const newActiveTasks = activeData.tasks || []
      const newRecentTasks = recentData.tasks || []

      // Check for newly completed tasks
      const newActiveIds = new Set<string>(newActiveTasks.map((t: Task) => t.id))
      const previousActiveIds = previousActiveIdsRef.current

      // Find tasks that were active but are no longer
      for (const prevId of previousActiveIds) {
        if (!newActiveIds.has(prevId)) {
          // Task completed - find it in recent tasks
          const completedTask = newRecentTasks.find((t: Task) => t.id === prevId)
          if (completedTask) {
            showNotification(completedTask)
          }
        }
      }

      previousActiveIdsRef.current = newActiveIds
      setActiveTasks(newActiveTasks)
      setRecentTasks(newRecentTasks)
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    }
  }, [showNotification])

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

  return (
    <TaskContext.Provider value={{
      activeTasks,
      recentTasks,
      isTaskRunning,
      getActiveTask,
      createTask,
      refreshTasks,
      selectedTask,
      setSelectedTask
    }}>
      {children}
    </TaskContext.Provider>
  )
}
