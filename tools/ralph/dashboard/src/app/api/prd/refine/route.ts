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

    // Build prompt
    const totalStories = stories.length
    const prompt = `You are reviewing PRD stories for clarity and implementability.

PROJECT: ${prd.project || 'Unknown'}
VERSION: ${version}
TOTAL PENDING STORIES: ${totalStories}

STORIES TO REVIEW:
${JSON.stringify(stories, null, 2)}

For each story, check:
1. Are acceptance criteria specific and testable?
2. Are there vague terms that need clarification? ("settings", "improve", "properly", "handle")
3. Should this story be split into smaller stories?
4. Are dependencies complete?
5. Are tags appropriate?

Output ONLY valid JSON (no markdown, no code blocks):
{
  "refinements": [
    {
      "id": "X.Y.Z",
      "title": "Original story title",
      "status": "ok" | "needs_work",
      "issues": ["issue 1", "issue 2"],
      "suggested_description": "Clear, specific description of what to implement and why",
      "suggested_acceptance": ["clearer criterion 1", "clearer criterion 2"],
      "tags": ["copy", "from", "original"],
      "depends_on": ["copy", "from", "original"]
    }
  ],
  "summary": "X of ${totalStories} pending stories need refinement"
}

IMPORTANT: Copy the original tags and depends_on arrays exactly as they are in the input stories.

Be pragmatic - only flag real issues that could lead to wrong implementations.
If a story is fine, set status to "ok" with empty issues/suggestions.`

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
