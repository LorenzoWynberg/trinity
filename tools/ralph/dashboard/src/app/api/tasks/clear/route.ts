import { NextResponse } from 'next/server'
import { markAllTasksRead } from '@/lib/tasks'

// POST /api/tasks/clear - Mark all completed/failed tasks as read
export async function POST() {
  try {
    const count = markAllTasksRead()
    return NextResponse.json({ marked: count })
  } catch (error: any) {
    console.error('[tasks/clear] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
