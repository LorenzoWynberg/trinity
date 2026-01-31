'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export type TaskType = 'refine' | 'generate' | 'story-edit' | 'align'
export type TaskStatus = 'queued' | 'running' | 'complete' | 'failed'

export interface TaskContext {
  returnPath?: string
  step?: string
  modalType?: string
  tempFile?: string
  selectedIds?: string[]
  formData?: Record<string, any>
  [key: string]: any
}

export interface Task {
  id: string
  type: TaskType
  status: TaskStatus
  version: string
  params: Record<string, any>
  context?: TaskContext
  created_at: string
  started_at?: string
  completed_at?: string
  read_at?: string
  deleted_at?: string
  result?: any
  error?: string
}

interface TaskStore {
  // Task data (synced from server)
  tasks: Task[]
  unreadCount: number

  // Client-side state
  pendingTasks: Task[]  // Tasks to show in modals after navigation

  // Actions
  setTasks: (tasks: Task[], unreadCount?: number) => void
  addPendingTask: (task: Task) => void
  removePendingTask: (taskId: string) => void
  clearPendingTasks: () => void

  // Getters
  getTask: (id: string) => Task | undefined
  getActiveTasks: () => Task[]
  getUnreadTasks: () => Task[]
  getUnseenCount: () => number
  getTasksByType: (type: TaskType) => Task[]
  isTaskRunning: (type: TaskType) => boolean
}

export const useTaskStore = create<TaskStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      tasks: [],
      unreadCount: 0,
      pendingTasks: [],

      // Actions
      setTasks: (tasks, unreadCount) => set((state) => {
        state.tasks = tasks
        if (unreadCount !== undefined) {
          state.unreadCount = unreadCount
        }
      }),

      addPendingTask: (task) => set((state) => {
        // Don't add duplicates
        if (!state.pendingTasks.find(t => t.id === task.id)) {
          state.pendingTasks.push(task)
        }
      }),

      removePendingTask: (taskId) => set((state) => {
        state.pendingTasks = state.pendingTasks.filter(t => t.id !== taskId)
      }),

      clearPendingTasks: () => set((state) => {
        state.pendingTasks = []
      }),

      // Getters
      getTask: (id) => {
        return get().tasks.find(t => t.id === id)
      },

      getActiveTasks: () => {
        return get().tasks.filter(t => t.status === 'queued' || t.status === 'running')
      },

      getUnreadTasks: () => {
        return get().tasks.filter(t =>
          (t.status === 'complete' || t.status === 'failed') &&
          !t.read_at
        )
      },

      getUnseenCount: () => {
        return get().unreadCount
      },

      getTasksByType: (type) => {
        return get().tasks.filter(t => t.type === type)
      },

      isTaskRunning: (type) => {
        return get().tasks.some(t =>
          t.type === type && (t.status === 'queued' || t.status === 'running')
        )
      },
    })),
    {
      name: 'ralph-tasks',
      partialize: (state) => ({
        pendingTasks: state.pendingTasks,
      }) as TaskStore,
    }
  )
)
