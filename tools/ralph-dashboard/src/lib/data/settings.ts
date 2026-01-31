import { settings as settingsDb } from '../db'

export type Theme = 'light' | 'dark' | 'cyber-light' | 'cyber-dark' | 'system'
export type GraphDirection = 'horizontal' | 'vertical'

export type Settings = {
  theme: Theme
  graphDirection: GraphDirection
  showDeadEnds: boolean
  showExternalDeps: boolean
  defaultVersion: string
  timezone: string
  dashboardUrl?: string
}

const defaultSettings: Settings = {
  theme: 'dark',
  graphDirection: 'horizontal',
  showDeadEnds: false,
  showExternalDeps: false,
  defaultVersion: '',
  timezone: 'UTC',
  dashboardUrl: 'http://localhost:4000'
}

export async function getSettings(): Promise<Settings> {
  try {
    const stored = settingsDb.getAll()
    return {
      theme: (stored.theme as Theme) || defaultSettings.theme,
      graphDirection: (stored.graphDirection as GraphDirection) || defaultSettings.graphDirection,
      showDeadEnds: stored.showDeadEnds === 'true',
      showExternalDeps: stored.showExternalDeps === 'true',
      defaultVersion: stored.defaultVersion || defaultSettings.defaultVersion,
      timezone: stored.timezone || defaultSettings.timezone,
      dashboardUrl: stored.dashboardUrl || defaultSettings.dashboardUrl,
    }
  } catch {
    return defaultSettings
  }
}
