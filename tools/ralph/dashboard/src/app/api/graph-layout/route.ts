import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const LAYOUTS_DIR = path.join(process.cwd(), 'graph-layouts')

// Ensure directory exists
async function ensureDir() {
  try {
    await fs.mkdir(LAYOUTS_DIR, { recursive: true })
  } catch {
    // Directory exists
  }
}

function getLayoutFile(version: string) {
  const safeVersion = version.replace(/[^a-zA-Z0-9.-]/g, '_')
  return path.join(LAYOUTS_DIR, `${safeVersion}.json`)
}

export async function GET(request: NextRequest) {
  const version = request.nextUrl.searchParams.get('version') || 'all'

  try {
    await ensureDir()
    const content = await fs.readFile(getLayoutFile(version), 'utf-8')
    return NextResponse.json(JSON.parse(content))
  } catch {
    // Return default layout
    return NextResponse.json({
      layout: 'horizontal',
      positions: {}
    })
  }
}

export async function POST(request: NextRequest) {
  const version = request.nextUrl.searchParams.get('version') || 'all'
  const data = await request.json()

  try {
    await ensureDir()
    await fs.writeFile(
      getLayoutFile(version),
      JSON.stringify(data, null, 2),
      'utf-8'
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save layout:', error)
    return NextResponse.json({ success: false, error: 'Failed to save' }, { status: 500 })
  }
}
