import { api } from './client'
import type { State } from '../types'

export interface RunParams {
  version: string
  mode: 'single' | 'continuous'
  storyId?: string
}

export interface RunResponse {
  success: boolean
  message: string
  storyId?: string
}

export interface SignalParams {
  storyId: string
  action: 'complete' | 'blocked' | 'progress'
  message?: string
  prUrl?: string
}

export const runApi = {
  // Get current run state
  getState: () => api.get<State>('/api/state'),

  // Start a run
  start: (params: RunParams) =>
    api.post<RunResponse>('/api/run', params),

  // Stop a run
  stop: () =>
    api.post<RunResponse>('/api/run', { action: 'stop' }),

  // Signal completion/blocked
  signal: (params: SignalParams) =>
    api.post<{ success: boolean }>('/api/signal', params),
}
