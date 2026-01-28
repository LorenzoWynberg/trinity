'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export type Theme = 'light' | 'dark' | 'cyber-light' | 'cyber-dark' | 'system'
export type GraphDirection = 'horizontal' | 'vertical'

export interface Settings {
  // Appearance
  theme: Theme

  // Graph settings
  graphDirection: GraphDirection
  showDeadEnds: boolean
  showExternalDeps: boolean

  // Defaults
  defaultVersion: string

  // Locale
  timezone: string
}

interface SettingsStore extends Settings {
  // Actions
  setTheme: (theme: Theme) => void
  setGraphDirection: (direction: GraphDirection) => void
  setShowDeadEnds: (show: boolean) => void
  setShowExternalDeps: (show: boolean) => void
  setDefaultVersion: (version: string) => void
  setTimezone: (timezone: string) => void

  // Bulk update
  updateSettings: (settings: Partial<Settings>) => void

  // Reset to defaults
  resetSettings: () => void
}

const defaultSettings: Settings = {
  theme: 'dark',
  graphDirection: 'horizontal',
  showDeadEnds: false,
  showExternalDeps: false,
  defaultVersion: 'first',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    immer((set) => ({
      // Initial state
      ...defaultSettings,

      // Actions
      setTheme: (theme) => set((state) => {
        state.theme = theme
      }),

      setGraphDirection: (direction) => set((state) => {
        state.graphDirection = direction
      }),

      setShowDeadEnds: (show) => set((state) => {
        state.showDeadEnds = show
      }),

      setShowExternalDeps: (show) => set((state) => {
        state.showExternalDeps = show
      }),

      setDefaultVersion: (version) => set((state) => {
        state.defaultVersion = version
      }),

      setTimezone: (timezone) => set((state) => {
        state.timezone = timezone
      }),

      updateSettings: (settings) => set((state) => {
        Object.assign(state, settings)
      }),

      resetSettings: () => set(() => ({ ...defaultSettings })),
    })),
    {
      name: 'ralph-settings',
    }
  )
)

// Helper hook for getting settings as plain object (for passing to server components)
export function getSettingsSnapshot(): Settings {
  const state = useSettingsStore.getState()
  return {
    theme: state.theme,
    graphDirection: state.graphDirection,
    showDeadEnds: state.showDeadEnds,
    showExternalDeps: state.showExternalDeps,
    defaultVersion: state.defaultVersion,
    timezone: state.timezone,
  }
}
