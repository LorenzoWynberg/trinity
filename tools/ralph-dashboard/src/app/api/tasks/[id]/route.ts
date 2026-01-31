import { NextRequest, NextResponse } from 'next/server'
import { getTask, deleteTask, markTaskRead, softDeleteTask, restoreTask } from '@/lib/tasks'

// GET /api/tasks/:id - Get single task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const task = getTask(id)

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({ task })
  } catch (error: any) {
    console.error('[tasks/:id] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/tasks/:id - Update task (mark read, soft delete, restore)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action } = body

    let task
    switch (action) {
      case 'read':
        task = markTaskRead(id)
        break
      case 'delete':
        task = softDeleteTask(id)
        break
      case 'restore':
        task = restoreTask(id)
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({ task })
  } catch (error: any) {
    console.error('[tasks/:id] PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/tasks/:id - Hard delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const deleted = deleteTask(id)
    return NextResponse.json({ deleted })
  } catch (error: any) {
    console.error('[tasks/:id] DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
