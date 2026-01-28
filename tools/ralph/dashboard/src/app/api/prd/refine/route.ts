import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { runClaude, PRD_DIR } from '@/lib/claude'

// POST: Get refinement suggestions from Claude
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { version, storyId } = body

    if (!version) {
      return NextResponse.json({ error: 'version is required' }, { status: 400 })
    }

    const prdFile = path.join(PRD_DIR, `${version}.json`)
    const prdContent = await fs.readFile(prdFile, 'utf-8')
    const prd = JSON.parse(prdContent)

    // Get stories to refine
    let stories
    if (storyId) {
      stories = prd.stories.filter((s: any) => s.id === storyId)
    } else {
      // All pending stories
      stories = prd.stories.filter((s: any) => !s.passes && !s.merged && !s.skipped)
    }

    if (stories.length === 0) {
      return NextResponse.json({ refinements: [], summary: 'No stories to refine' })
    }

    // Build prompt - just point Claude to the PRD file
    const prompt = `Read the PRD file at: ${prdFile}

Review all stories where passes=false AND merged=false AND skipped=false.

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

    // Run Claude with temp files
    const { success, result, error, raw } = await runClaude(prompt)

    if (!success) {
      return NextResponse.json({ error, raw }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Refine error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT: Have Claude apply refinements to PRD
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { version, refinements } = body

    if (!version || !refinements || !Array.isArray(refinements)) {
      return NextResponse.json({ error: 'version and refinements array required' }, { status: 400 })
    }

    const prdFile = path.join(PRD_DIR, `${version}.json`)

    // Build prompt for Claude to apply the refinements
    const prompt = `You need to update the PRD file with refined story content.

PRD FILE: ${prdFile}

REFINEMENTS TO APPLY:
${JSON.stringify(refinements.map(r => ({
  id: r.id,
  new_description: r.suggested_description,
  new_acceptance: r.suggested_acceptance
})), null, 2)}

Instructions:
1. Read the PRD file at the path above
2. For each refinement, find the story by ID and update:
   - "description" field with new_description (if provided)
   - "acceptance" array with new_acceptance
3. Write the updated PRD back to the same file
4. Preserve all other fields and formatting

After completing, output this JSON:
{
  "applied": <number of stories updated>,
  "success": true
}`

    const { success, result, error, raw } = await runClaude(prompt, { timeoutMs: 60000 })

    if (!success) {
      return NextResponse.json({ error, raw }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Apply refinements error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
