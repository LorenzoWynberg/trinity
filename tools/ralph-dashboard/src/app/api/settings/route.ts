import { NextResponse } from 'next/server'
import { settings as settingsDb } from '@/lib/db'

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

const defaultSettings: Settings = {
  theme: 'dark',
  graphDirection: 'horizontal',
  showDeadEnds: false,
  showExternalDeps: false,
  defaultVersion: '',
  timezone: 'UTC',
  dashboardUrl: 'http://localhost:4000'
}

function getSettings(): Settings {
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
}

function saveSettings(settings: Partial<Settings>): void {
  const data: Record<string, string> = {}

  if (settings.theme !== undefined) data.theme = settings.theme
  if (settings.graphDirection !== undefined) data.graphDirection = settings.graphDirection
  if (settings.showDeadEnds !== undefined) data.showDeadEnds = String(settings.showDeadEnds)
  if (settings.showExternalDeps !== undefined) data.showExternalDeps = String(settings.showExternalDeps)
  if (settings.defaultVersion !== undefined) data.defaultVersion = settings.defaultVersion
  if (settings.timezone !== undefined) data.timezone = settings.timezone
  if (settings.dashboardUrl !== undefined) data.dashboardUrl = settings.dashboardUrl

  settingsDb.setAll(data)
}

// GET /api/settings - Get all settings
export async function GET() {
  try {
    const settings = getSettings()
    return NextResponse.json(settings)
  } catch (error: any) {
    console.error('[settings] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/settings - Update settings
export async function POST(request: Request) {
  try {
    const body = await request.json()
    saveSettings(body)
    const settings = getSettings()
    return NextResponse.json(settings)
  } catch (error: any) {
    console.error('[settings] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
