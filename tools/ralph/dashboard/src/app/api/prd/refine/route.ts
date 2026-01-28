import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'

const execAsync = promisify(exec)

const PROJECT_ROOT = path.join(process.cwd(), '../../..')
const RALPH_CLI_DIR = path.join(PROJECT_ROOT, 'tools/ralph/cli')
const PRD_DIR = path.join(RALPH_CLI_DIR, 'prd')

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
      "status": "ok" | "needs_work",
      "issues": ["issue 1", "issue 2"],
      "suggested_acceptance": ["clearer criterion 1", "clearer criterion 2"],
      "suggested_split": [
        {"title": "Smaller story 1", "acceptance": ["..."]},
        {"title": "Smaller story 2", "acceptance": ["..."]}
      ],
      "suggested_tags": ["tag1", "tag2"]
    }
  ],
  "summary": "X of ${totalStories} pending stories need refinement"
}

Be pragmatic - only flag real issues that could lead to wrong implementations.
If a story is fine, set status to "ok" with empty issues/suggestions.`

    // Run Claude
    const { stdout } = await execAsync(
      `echo ${JSON.stringify(prompt)} | claude --dangerously-skip-permissions --print`,
      { cwd: RALPH_CLI_DIR, timeout: 120000 }
    )

    // Parse JSON from output
    let result
    try {
      // Try to extract JSON from response
      const jsonMatch = stdout.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      return NextResponse.json({
        error: 'Failed to parse Claude response',
        raw: stdout
      }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Refine error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT: Apply refinements to PRD
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { version, refinements } = body

    if (!version || !refinements || !Array.isArray(refinements)) {
      return NextResponse.json({ error: 'version and refinements array required' }, { status: 400 })
    }

    const prdFile = path.join(PRD_DIR, `${version}.json`)
    const prdContent = await fs.readFile(prdFile, 'utf-8')
    const prd = JSON.parse(prdContent)

    let applied = 0
    for (const ref of refinements) {
      if (!ref.id || !ref.suggested_acceptance) continue

      const storyIndex = prd.stories.findIndex((s: any) => s.id === ref.id)
      if (storyIndex >= 0) {
        prd.stories[storyIndex].acceptance = ref.suggested_acceptance
        applied++
      }
    }

    // Sort stories
    prd.stories.sort((a: any, b: any) => {
      if (a.phase !== b.phase) return a.phase - b.phase
      if (a.epic !== b.epic) return a.epic - b.epic
      return a.story_number - b.story_number
    })

    await fs.writeFile(prdFile, JSON.stringify(prd, null, 2))

    return NextResponse.json({ success: true, applied })
  } catch (error: any) {
    console.error('Apply refinements error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
