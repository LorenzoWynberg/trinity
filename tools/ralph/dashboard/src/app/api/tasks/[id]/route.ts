import { NextRequest, NextResponse } from 'next/server'
import { getTask } from '@/lib/tasks'

// GET /api/tasks/:id - Get single task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const task = await getTask(id)

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({ task })
  } catch (error: any) {
    console.error('[tasks/:id] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
