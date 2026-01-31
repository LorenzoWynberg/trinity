/**
 * Centralized API client
 *
 * Usage:
 *   import { api } from '@/lib/api'
 *   const settings = await api.settings.get()
 *   const prd = await api.prd.get('v0.1')
 */

export { ApiError } from './client'
export { settingsApi, type Settings, type Theme, type GraphDirection } from './settings'
export { prdApi, type RefineResult, type StoryAnalysis, type GenerateResult } from './prd'
export { runApi, type RunParams, type RunResponse, type SignalParams, type ExecutionStatus } from './run'
export { metricsApi } from './metrics'
export { tasksApi, type Task } from './tasks'

// Convenience namespace
import { settingsApi } from './settings'
import { prdApi } from './prd'
import { runApi } from './run'
import { metricsApi } from './metrics'
import { tasksApi } from './tasks'

export const api = {
  settings: settingsApi,
  prd: prdApi,
  run: runApi,
  metrics: metricsApi,
  tasks: tasksApi,
}
