import { NextResponse } from 'next/server'
import { getPRD } from '@/lib/data'

export const revalidate = 5

export async function GET() {
  const prd = await getPRD()
  return NextResponse.json(prd)
}
