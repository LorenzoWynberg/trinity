import { api } from './client'
import type { State, Story } from '../types'
import type { StoryScore } from '../scoring'

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

export interface ExecutionStatus {
  state: State
  progress: { total: number; merged: number; passed: number; percentage: number }
  nextStory: Story | null
  scoredStories: StoryScore[]
}

export const runApi = {
  // Get current run state
  getState: () => api.get<State>('/api/state'),

  // Get execution status with progress and queue
  getExecutionStatus: (version: string) =>
    api.get<ExecutionStatus>(`/api/run?version=${encodeURIComponent(version)}`),

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
