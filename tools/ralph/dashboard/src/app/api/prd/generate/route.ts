import { NextRequest, NextResponse } from 'next/server'
import { runClaude } from '@/lib/claude'
import * as prdDb from '@/lib/db/prd'
import { getPrompt } from '@/lib/prompts'

// POST: Generate stories from description
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { version, description } = body

    if (!version || !description) {
      return NextResponse.json({ error: 'version and description are required' }, { status: 400 })
    }

    const prd = prdDb.getPRD(version)
    if (!prd) {
      return NextResponse.json({ error: `Version ${version} not found` }, { status: 404 })
    }

    const existingStories = prd.stories.map((s) => ({
      id: s.id,
      title: s.title,
      phase: s.phase,
      epic: s.epic,
      tags: s.tags
    }))

    const prompt = getPrompt('generate', {
      PROJECT: prd.project || 'Unknown',
      VERSION: version,
      PHASES: JSON.stringify(prd.phases || [], null, 2),
      EPICS: JSON.stringify(prd.epics || [], null, 2),
      EXISTING_STORIES: JSON.stringify(existingStories, null, 2),
      DESCRIPTION: description
    })

    // Run Claude with temp files
    const { success, result, error, raw } = await runClaude(prompt)

    if (!success) {
      return NextResponse.json({ error, raw }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Generate error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT: Add generated stories to PRD database
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { version, stories } = body

    if (!version || !stories || !Array.isArray(stories)) {
      return NextResponse.json({ error: 'version and stories array required' }, { status: 400 })
    }

    const prd = prdDb.getPRD(version)
    if (!prd) {
      return NextResponse.json({ error: `Version ${version} not found` }, { status: 404 })
    }

    // Find max story numbers per phase.epic
    const maxStoryNumbers = new Map<string, number>()
    for (const s of prd.stories) {
      const key = `${s.phase}.${s.epic}`
      const current = maxStoryNumbers.get(key) || 0
      if (s.story_number && s.story_number > current) {
        maxStoryNumbers.set(key, s.story_number)
      }
    }

    // Build stories with IDs
    const storiesToAdd = stories.map((s: any) => {
      const key = `${s.phase}.${s.epic}`
      const nextNum = (maxStoryNumbers.get(key) || 0) + 1
      maxStoryNumbers.set(key, nextNum)

      return {
        id: `${version}:${s.phase}.${s.epic}.${nextNum}`,
        title: s.title,
        intent: s.intent,
        acceptance: s.acceptance || [],
        phase: s.phase,
        epic: s.epic,
        story_number: nextNum,
        target_version: version,
        depends_on: s.depends_on || [],
        tags: s.tags || [],
        passes: false,
        merged: false,
        skipped: false
      }
    })

    // Add to database
    prdDb.stories.bulkCreate(storiesToAdd)

    return NextResponse.json({
      added: storiesToAdd.length,
      success: true,
      stories: storiesToAdd.map(s => ({ id: s.id, title: s.title }))
    })
  } catch (error: any) {
    console.error('Add stories error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
