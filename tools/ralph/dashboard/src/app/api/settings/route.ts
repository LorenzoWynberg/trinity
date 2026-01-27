import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json')

type Settings = {
  theme: 'light' | 'dark' | 'system'
  graphDirection: 'horizontal' | 'vertical'
  showDeadEnds: boolean
  defaultVersion: string // 'first' means use first available version
  timezone: string // IANA timezone name (e.g., 'America/Costa_Rica') or UTC offset (e.g., 'UTC-6')
}

const defaultSettings: Settings = {
  theme: 'dark',
  graphDirection: 'horizontal',
  showDeadEnds: false,
  defaultVersion: 'first',
  timezone: 'America/Costa_Rica'
}

async function getSettings(): Promise<Settings> {
  try {
    const content = await fs.readFile(SETTINGS_FILE, 'utf-8')
    return { ...defaultSettings, ...JSON.parse(content) }
  } catch {
    return defaultSettings
  }
}

async function saveSettings(settings: Settings): Promise<void> {
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2))
}

export async function GET() {
  const settings = await getSettings()
  return NextResponse.json(settings)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const currentSettings = await getSettings()
    const newSettings = { ...currentSettings, ...body }
    await saveSettings(newSettings)
    return NextResponse.json(newSettings)
  } catch {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
