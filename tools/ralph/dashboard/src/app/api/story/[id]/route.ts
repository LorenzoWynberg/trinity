import { NextRequest, NextResponse } from 'next/server'
import * as prd from '@/lib/db/prd'

// GET /api/story/[id] - Get a single story by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const story = prd.stories.get(id)

    if (!story) {
      return NextResponse.json({ error: `Story ${id} not found` }, { status: 404 })
    }

    return NextResponse.json(story)
  } catch (error: any) {
    console.error('[story] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
