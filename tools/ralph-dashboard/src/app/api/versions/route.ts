import { NextResponse } from 'next/server'
import { getVersions, getVersionProgress } from '@/lib/data'

export const revalidate = 5

export async function GET() {
  const [versions, progress] = await Promise.all([
    getVersions(),
    getVersionProgress()
  ])
  return NextResponse.json({ versions, progress })
}
