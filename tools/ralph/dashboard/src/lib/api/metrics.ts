import { api } from './client'
import type { Metrics } from '../types'

export const metricsApi = {
  get: () => api.get<Metrics>('/api/metrics'),
}
