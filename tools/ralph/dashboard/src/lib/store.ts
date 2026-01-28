'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export type TaskType = 'refine' | 'generate' | 'story-edit'
export type TaskStatus = 'queued' | 'running' | 'complete' | 'failed'

export interface Task {
  id: string
  type: TaskType
  status: TaskStatus
  version: string
  params: Record<string, any>
  created_at: string
  started_at?: string
  completed_at?: string
  result?: any
  error?: string
}

interface DashboardState {
  // Task state
  tasks: Task[]
  seenTaskIds: Set<string>
  selectedTaskId: string | null

  // UI state
  selectedVersion: string
  sidebarCollapsed: boolean

  // Actions
  setTasks: (tasks: Task[]) => void
  markTaskSeen: (taskId: string) => void
  setSelectedTaskId: (taskId: string | null) => void
  setSelectedVersion: (version: string) => void
  setSidebarCollapsed: (collapsed: boolean) => void

  // Computed
  getUnseenCount: () => number
  getSelectedTask: () => Task | undefined
  getActiveTasks: () => Task[]
  getRecentTasks: () => Task[]
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      tasks: [],
      seenTaskIds: new Set<string>(),
      selectedTaskId: null,
      selectedVersion: 'v0.1',
      sidebarCollapsed: false,

      // Actions
      setTasks: (tasks) => set((state) => {
        state.tasks = tasks
      }),

      markTaskSeen: (taskId) => set((state) => {
        state.seenTaskIds.add(taskId)
      }),

      setSelectedTaskId: (taskId) => set((state) => {
        state.selectedTaskId = taskId
        if (taskId) {
          state.seenTaskIds.add(taskId)
        }
      }),

      setSelectedVersion: (version) => set((state) => {
        state.selectedVersion = version
      }),

      setSidebarCollapsed: (collapsed) => set((state) => {
        state.sidebarCollapsed = collapsed
      }),

      // Computed
      getUnseenCount: () => {
        const { tasks, seenTaskIds } = get()
        return tasks.filter(t =>
          (t.status === 'complete' || t.status === 'failed') &&
          !seenTaskIds.has(t.id)
        ).length
      },

      getSelectedTask: () => {
        const { tasks, selectedTaskId } = get()
        return tasks.find(t => t.id === selectedTaskId)
      },

      getActiveTasks: () => {
        const { tasks } = get()
        return tasks.filter(t => t.status === 'queued' || t.status === 'running')
      },

      getRecentTasks: () => {
        const { tasks } = get()
        return tasks
          .filter(t => t.status === 'complete' || t.status === 'failed')
          .slice(0, 10)
      },
    })),
    {
      name: 'ralph-dashboard',
      // Custom serialization for Set
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const parsed = JSON.parse(str)
          // Convert seenTaskIds array back to Set
          if (parsed.state?.seenTaskIds) {
            parsed.state.seenTaskIds = new Set(parsed.state.seenTaskIds)
          }
          return parsed
        },
        setItem: (name, value) => {
          // Convert Set to array for serialization
          const toStore = {
            ...value,
            state: {
              ...value.state,
              seenTaskIds: Array.from(value.state.seenTaskIds || [])
            }
          }
          localStorage.setItem(name, JSON.stringify(toStore))
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      // Only persist these fields
      partialize: (state) => ({
        seenTaskIds: state.seenTaskIds,
        selectedVersion: state.selectedVersion,
        sidebarCollapsed: state.sidebarCollapsed,
      }) as DashboardState,
    }
  )
)
