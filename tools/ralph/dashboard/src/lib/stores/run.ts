'use client'

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { runApi, type RunParams } from '../api/run'
import type { State, RunStatus } from '../types'

interface RunState {
  // Data
  state: State | null

  // Loading states
  isLoading: boolean
  isStarting: boolean
  isStopping: boolean
  error: string | null

  // Actions
  loadState: () => Promise<void>
  start: (params: RunParams) => Promise<void>
  stop: () => Promise<void>

  // Derived
  isRunning: () => boolean
  currentStoryId: () => string | null
}

const initialState: State = {
  version: 1,
  current_story: null,
  status: 'idle',
  branch: null,
  pr_url: null,
  started_at: null,
  last_updated: null,
  attempts: 0,
  error: null,
  checkpoints: [],
}

export const useRunStore = create<RunState>()(
  immer((set, get) => ({
    // Initial state
    state: null,
    isLoading: false,
    isStarting: false,
    isStopping: false,
    error: null,

    loadState: async () => {
      set((state) => { state.isLoading = true })
      try {
        const runState = await runApi.getState()
        set((state) => {
          state.state = runState
          state.isLoading = false
        })
      } catch (error: any) {
        set((state) => {
          state.isLoading = false
          state.error = error.message
        })
      }
    },

    start: async (params) => {
      set((state) => {
        state.isStarting = true
        state.error = null
      })
      try {
        await runApi.start(params)
        await get().loadState()
        set((state) => { state.isStarting = false })
      } catch (error: any) {
        set((state) => {
          state.isStarting = false
          state.error = error.message
        })
        throw error
      }
    },

    stop: async () => {
      set((state) => {
        state.isStopping = true
        state.error = null
      })
      try {
        await runApi.stop()
        await get().loadState()
        set((state) => { state.isStopping = false })
      } catch (error: any) {
        set((state) => {
          state.isStopping = false
          state.error = error.message
        })
        throw error
      }
    },

    isRunning: () => {
      const status = get().state?.status
      return status === 'running' || status === 'waiting_gate'
    },

    currentStoryId: () => get().state?.current_story || null,
  }))
)
