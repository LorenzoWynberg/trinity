import { NextRequest, NextResponse } from 'next/server'
import { getPRD } from '@/lib/data'

export const revalidate = 5

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const version = searchParams.get('version') || undefined
  const prd = await getPRD(version)
  return NextResponse.json(prd)
}
