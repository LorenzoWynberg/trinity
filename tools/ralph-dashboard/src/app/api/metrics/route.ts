import { NextResponse } from 'next/server'
import { getMetrics } from '@/lib/data'

export const revalidate = 5

export async function GET() {
  const metrics = await getMetrics()
  return NextResponse.json(metrics)
}
