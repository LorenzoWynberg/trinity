import { NextResponse } from 'next/server'
import { getState } from '@/lib/data'

export const revalidate = 5

export async function GET() {
  const state = await getState()
  return NextResponse.json(state)
}
