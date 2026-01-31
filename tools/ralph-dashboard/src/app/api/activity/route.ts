import { NextRequest, NextResponse } from 'next/server'
import * as activityDb from '@/lib/db/activity'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const project = searchParams.get('project') as activityDb.ActivityProject | null
  const storyId = searchParams.get('storyId')
  const limit = parseInt(searchParams.get('limit') || '100', 10)

  if (storyId) {
    const logs = activityDb.getByStory(storyId)
    return NextResponse.json({ logs })
  }

  const validProject = project === 'ralph' ? 'ralph' : 'trinity'
  const logs = activityDb.list(validProject, limit)

  return NextResponse.json({ logs, project: validProject })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    if (!body.content || typeof body.content !== 'string' || body.content.trim() === '') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    // Validate project if provided
    const validProjects = ['ralph', 'trinity']
    if (body.project && !validProjects.includes(body.project)) {
      return NextResponse.json({ error: `Invalid project: ${body.project}. Must be one of: ${validProjects.join(', ')}` }, { status: 400 })
    }

    // Validate status if provided
    const validStatuses = ['complete', 'in_progress', 'blocked']
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status: ${body.status}. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
    }

    const log = activityDb.create({
      project: body.project || 'trinity',
      date: body.date,
      time: body.time,
      title: body.title,
      content: body.content,
      status: body.status || 'complete',
      files_changed: body.filesChanged || body.files_changed,
      files_created: body.filesCreated || body.files_created,
      tags: body.tags,
      story_id: body.storyId || body.story_id
    })

    return NextResponse.json({ success: true, log })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    )
  }
}
