import { NextRequest, NextResponse } from 'next/server'
import { runClaude } from '@/lib/claude'
import * as prdDb from '@/lib/db/prd'

// POST: Get refinement suggestions from Claude
export async function POST(request: NextRequest) {
  console.log('[refine] POST request received')
  try {
    const body = await request.json()
    console.log('[refine] Body:', JSON.stringify(body))
    const { version, storyId } = body

    if (!version) {
      return NextResponse.json({ error: 'version is required' }, { status: 400 })
    }

    const prd = prdDb.getPRD(version)
    if (!prd) {
      return NextResponse.json({ error: `Version ${version} not found` }, { status: 404 })
    }
    console.log('[refine] PRD loaded, story count:', prd.stories?.length)

    // Get stories to refine
    let stories
    if (storyId) {
      stories = prd.stories.filter((s) => s.id === storyId)
    } else {
      // All pending stories
      stories = prd.stories.filter((s) => !s.passes && !s.merged && !s.skipped)
    }

    if (stories.length === 0) {
      return NextResponse.json({ refinements: [], summary: 'No stories to refine' })
    }

    // Build prompt with story data
    const prompt = `Review these stories for clarity and testability:

STORIES TO REVIEW:
${JSON.stringify(stories.map(s => ({
  id: s.id,
  title: s.title,
  description: s.description,
  acceptance: s.acceptance,
  tags: s.tags,
  depends_on: s.depends_on
})), null, 2)}

For each story, check:
1. Are acceptance criteria specific and testable?
2. Are there vague terms? ("settings", "improve", "properly", "handle")
3. Should it be split into smaller stories?

Output JSON:
{
  "refinements": [
    {
      "id": "X.Y.Z",
      "title": "story title",
      "status": "ok" | "needs_work",
      "issues": ["issue 1"],
      "suggested_description": "clearer description",
      "suggested_acceptance": ["criterion 1", "criterion 2"],
      "tags": ["from", "original"],
      "depends_on": ["from", "original"]
    }
  ],
  "summary": "X of Y stories need refinement"
}

Copy tags and depends_on from original. Be pragmatic - only flag real issues.`

    // Run Claude with temp files - use longer timeout for analyzing many stories
    console.log('[refine] Calling runClaude, prompt length:', prompt.length)
    const { success, result, error, raw } = await runClaude(prompt)
    console.log('[refine] runClaude returned, success:', success)

    if (!success) {
      console.log('[refine] Error:', error)
      return NextResponse.json({ error, raw }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Refine error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT: Apply refinements to database
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { version, refinements } = body

    if (!version || !refinements || !Array.isArray(refinements)) {
      return NextResponse.json({ error: 'version and refinements array required' }, { status: 400 })
    }

    let applied = 0
    for (const refinement of refinements) {
      const story = prdDb.stories.get(refinement.id)
      if (!story) continue

      const changes: any = {}
      if (refinement.suggested_description) {
        changes.description = refinement.suggested_description
      }
      if (refinement.suggested_acceptance) {
        changes.acceptance = refinement.suggested_acceptance
      }

      if (Object.keys(changes).length > 0) {
        prdDb.stories.update(refinement.id, changes)
        applied++
      }
    }

    return NextResponse.json({
      applied,
      success: true
    })
  } catch (error: any) {
    console.error('Apply refinements error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
