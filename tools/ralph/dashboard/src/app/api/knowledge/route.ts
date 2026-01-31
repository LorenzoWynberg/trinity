import { NextRequest, NextResponse } from 'next/server'
import * as knowledgeDb from '@/lib/db/knowledge'
import * as gotchasDb from '@/lib/db/gotchas'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const book = searchParams.get('book') || 'knowledge'
  const chapterSlug = searchParams.get('chapter')
  const query = searchParams.get('q')
  const tag = searchParams.get('tag')

  const db = book === 'gotchas' ? gotchasDb : knowledgeDb

  // Search
  if (query) {
    const results = db.search(query)
    return NextResponse.json({ results })
  }

  // Find by tag
  if (tag) {
    const results = db.findByTag(tag)
    return NextResponse.json({ results })
  }

  // List chapters
  if (!chapterSlug) {
    const chapters = db.listChapters()
    return NextResponse.json({ chapters })
  }

  // Get chapter with pages
  const chapter = db.getChapter(chapterSlug)
  if (!chapter) {
    return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
  }

  const pages = db.listPagesInChapter(chapter.id)
  return NextResponse.json({ chapter, pages })
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

    // Validate book if provided
    const validBooks = ['knowledge', 'gotchas']
    const book = body.book || 'knowledge'
    if (!validBooks.includes(book)) {
      return NextResponse.json({ error: `Invalid book: ${book}. Must be one of: ${validBooks.join(', ')}` }, { status: 400 })
    }

    // Validate source if provided
    const validSources = ['claude', 'user', 'import']
    if (body.source && !validSources.includes(body.source)) {
      return NextResponse.json({ error: `Invalid source: ${body.source}. Must be one of: ${validSources.join(', ')}` }, { status: 400 })
    }

    // Determine which db to use
    const db = book === 'gotchas' ? gotchasDb : knowledgeDb

    // Create a new learning/gotcha page
    const page = db.createPage(body.chapter || 'general', {
      slug: body.slug || `learning-${Date.now()}`,
      title: body.title,
      content: body.content,
      story_id: body.storyId || body.story_id,
      source: body.source || 'claude',
      tags: body.tags
    })

    return NextResponse.json({ success: true, page })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    )
  }
}
