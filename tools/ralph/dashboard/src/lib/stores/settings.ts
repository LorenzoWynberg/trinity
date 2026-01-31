'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { settingsApi, type Settings, type Theme, type GraphDirection } from '../api/settings'

interface SettingsState extends Settings {
  // Loading state
  isLoading: boolean
  isInitialized: boolean

  // Actions
  setTheme: (theme: Theme) => void
  setGraphDirection: (direction: GraphDirection) => void
  setShowDeadEnds: (show: boolean) => void
  setShowExternalDeps: (show: boolean) => void
  setDefaultVersion: (version: string) => void
  setTimezone: (timezone: string) => void
  setDashboardUrl: (url: string) => void

  // Bulk update (syncs to server)
  updateSettings: (settings: Partial<Settings>) => Promise<void>

  // Load from server
  loadSettings: () => Promise<void>

  // Reset to defaults
  resetSettings: () => void
}

const defaultSettings: Settings = {
  theme: 'dark',
  graphDirection: 'horizontal',
  showDeadEnds: false,
  showExternalDeps: false,
  defaultVersion: 'first',
  timezone: typeof window !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC',
  dashboardUrl: 'http://localhost:3000',
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      ...defaultSettings,
      isLoading: false,
      isInitialized: false,

      // Individual setters (local only, use updateSettings to sync)
      setTheme: (theme) => set((state) => { state.theme = theme }),
      setGraphDirection: (direction) => set((state) => { state.graphDirection = direction }),
      setShowDeadEnds: (show) => set((state) => { state.showDeadEnds = show }),
      setShowExternalDeps: (show) => set((state) => { state.showExternalDeps = show }),
      setDefaultVersion: (version) => set((state) => { state.defaultVersion = version }),
      setTimezone: (timezone) => set((state) => { state.timezone = timezone }),
      setDashboardUrl: (url) => set((state) => { state.dashboardUrl = url }),

      // Bulk update with server sync
      updateSettings: async (settings) => {
        set((state) => { state.isLoading = true })
        try {
          const updated = await settingsApi.update(settings)
          set((state) => {
            Object.assign(state, updated)
            state.isLoading = false
          })
        } catch (error) {
          set((state) => { state.isLoading = false })
          throw error
        }
      },

      // Load from server
      loadSettings: async () => {
        set((state) => { state.isLoading = true })
        try {
          const settings = await settingsApi.get()
          set((state) => {
            Object.assign(state, settings)
            state.isLoading = false
            state.isInitialized = true
          })
        } catch (error) {
          set((state) => {
            state.isLoading = false
            state.isInitialized = true
          })
          console.error('Failed to load settings:', error)
        }
      },

      resetSettings: () => set(() => ({ ...defaultSettings, isLoading: false, isInitialized: true })),
    })),
    {
      name: 'ralph-settings',
      partialize: (state) => ({
        theme: state.theme,
        graphDirection: state.graphDirection,
        showDeadEnds: state.showDeadEnds,
        showExternalDeps: state.showExternalDeps,
        defaultVersion: state.defaultVersion,
        timezone: state.timezone,
        dashboardUrl: state.dashboardUrl,
      }),
    }
  )
)

// Re-export types
export type { Settings, Theme, GraphDirection }
