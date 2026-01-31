'use client'

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { prdApi } from '../api/prd'
import type { PRD, Story, VersionInfo } from '../types'

interface PrdState {
  // Data
  prd: PRD | null
  versions: string[]
  versionsWithMetadata: VersionInfo[]
  currentVersion: string

  // Loading states
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Actions
  setCurrentVersion: (version: string) => void
  loadPrd: (version?: string) => Promise<void>
  loadVersions: () => Promise<void>
  getStory: (id: string) => Story | undefined
  refresh: () => Promise<void>
}

export const usePrdStore = create<PrdState>()(
  immer((set, get) => ({
    // Initial state
    prd: null,
    versions: [],
    versionsWithMetadata: [],
    currentVersion: 'v0.1',
    isLoading: false,
    isInitialized: false,
    error: null,

    setCurrentVersion: (version) => {
      set((state) => { state.currentVersion = version })
      get().loadPrd(version)
    },

    loadPrd: async (version) => {
      const v = version || get().currentVersion
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const prd = await prdApi.get(v)
        set((state) => {
          state.prd = prd
          state.currentVersion = v
          state.isLoading = false
          state.isInitialized = true
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.isInitialized = true
          state.error = error.message
        })
      }
    },

    loadVersions: async () => {
      try {
        const data = await prdApi.getVersionsWithProgress()
        set((state) => {
          state.versions = data.versions
          state.versionsWithMetadata = data.progress
        })
      } catch (error: any) {
        console.error('Failed to load versions:', error)
      }
    },

    getStory: (id) => {
      return get().prd?.stories.find((s) => s.id === id)
    },

    refresh: async () => {
      await Promise.all([
        get().loadPrd(),
        get().loadVersions(),
      ])
    },
  }))
)
