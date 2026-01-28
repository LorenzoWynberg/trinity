import { NextRequest, NextResponse } from 'next/server'
import {
  createTask,
  getTasks,
  getActiveTasks,
  getTasksByType,
  cleanupTasks,
  type TaskType
} from '@/lib/tasks'

// GET /api/tasks - List tasks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as TaskType | null
    const status = searchParams.get('status')
    const active = searchParams.get('active')
    const limit = searchParams.get('limit')

    let tasks

    if (active === 'true') {
      tasks = await getActiveTasks()
    } else if (type && !status) {
      tasks = await getTasksByType(type)
    } else {
      tasks = await getTasks({
        type: type || undefined,
        status: status ? status.split(',') as any : undefined,
        limit: limit ? parseInt(limit) : undefined
      })
    }

    return NextResponse.json({ tasks })
  } catch (error: any) {
    console.error('[tasks] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/tasks - Create new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, version, params } = body

    if (!type || !version) {
      return NextResponse.json(
        { error: 'type and version are required' },
        { status: 400 }
      )
    }

    const task = await createTask(type, version, params || {})

    // Cleanup old tasks periodically
    cleanupTasks().catch(console.error)

    return NextResponse.json({ task })
  } catch (error: any) {
    console.error('[tasks] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
