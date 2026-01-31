'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// Re-export task types from task-store for convenience
export type { Task, TaskType, TaskStatus, TaskContext } from './task-store'
export { useTaskStore } from './task-store'

interface DashboardState {
  // UI state
  selectedVersion: string
  sidebarCollapsed: boolean

  // Actions
  setSelectedVersion: (version: string) => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    immer((set) => ({
      // Initial state
      selectedVersion: 'v0.1',
      sidebarCollapsed: false,

      // Actions
      setSelectedVersion: (version) => set((state) => {
        state.selectedVersion = version
      }),

      setSidebarCollapsed: (collapsed) => set((state) => {
        state.sidebarCollapsed = collapsed
      }),
    })),
    {
      name: 'ralph-dashboard',
      partialize: (state) => ({
        selectedVersion: state.selectedVersion,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
)
