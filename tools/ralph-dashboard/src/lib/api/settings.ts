import { api } from './client'

export type Theme = 'light' | 'dark' | 'cyber-light' | 'cyber-dark' | 'system'
export type GraphDirection = 'horizontal' | 'vertical'

export interface Settings {
  theme: Theme
  graphDirection: GraphDirection
  showDeadEnds: boolean
  showExternalDeps: boolean
  defaultVersion: string
  timezone: string
  dashboardUrl: string
}

export const settingsApi = {
  get: () => api.get<Settings>('/api/settings'),

  update: (settings: Partial<Settings>) =>
    api.post<Settings>('/api/settings', settings),
}
