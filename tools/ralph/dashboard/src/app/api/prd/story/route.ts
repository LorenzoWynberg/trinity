import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'

const execAsync = promisify(exec)

const PROJECT_ROOT = path.join(process.cwd(), '../../..')
const RALPH_CLI_DIR = path.join(PROJECT_ROOT, 'tools/ralph/cli')
const PRD_DIR = path.join(RALPH_CLI_DIR, 'prd')

// POST: Analyze requested changes and check related stories
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { version, storyId, requestedChanges } = body

    if (!version || !storyId || !requestedChanges) {
      return NextResponse.json({ error: 'version, storyId, and requestedChanges are required' }, { status: 400 })
    }

    const prdFile = path.join(PRD_DIR, `${version}.json`)
    const prdContent = await fs.readFile(prdFile, 'utf-8')
    const prd = JSON.parse(prdContent)

    const story = prd.stories.find((s: any) => s.id === storyId)
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    // Find related stories (same tags, dependents, dependencies)
    const storyTags = new Set(story.tags || [])
    const relatedStories = prd.stories.filter((s: any) => {
      if (s.id === storyId) return false
      // Same tags (at least 2 overlap)
      const overlap = (s.tags || []).filter((t: string) => storyTags.has(t))
      if (overlap.length >= 2) return true
      // Depends on this story
      if (s.depends_on?.includes(storyId)) return true
      // This story depends on it
      if (story.depends_on?.includes(s.id)) return true
      return false
    })

    // Build prompt for Claude
    const prompt = `You are updating a PRD story based on user feedback.

CURRENT STORY:
${JSON.stringify(story, null, 2)}

USER REQUESTED CHANGES:
${requestedChanges}

RELATED STORIES (same tags or dependencies):
${JSON.stringify(relatedStories.map((s: any) => ({ id: s.id, title: s.title, tags: s.tags, acceptance: s.acceptance })), null, 2)}

Tasks:
1. Generate updated acceptance criteria for the target story based on the requested changes
2. Check if any related stories need updates to stay consistent
3. Be specific - avoid vague terms

Output ONLY valid JSON (no markdown, no code blocks):
{
  "updatedStory": {
    "acceptance": ["updated criterion 1", "updated criterion 2"],
    "intent": "updated intent if needed, or keep original"
  },
  "relatedUpdates": [
    {
      "id": "X.Y.Z",
      "reason": "Why this story needs updating",
      "suggestedAcceptance": ["updated criterion 1"]
    }
  ],
  "summary": "Brief description of changes made"
}`

    // Run Claude
    const { stdout } = await execAsync(
      `echo ${JSON.stringify(prompt)} | claude --dangerously-skip-permissions --print`,
      { cwd: RALPH_CLI_DIR, timeout: 120000 }
    )

    // Parse JSON from output
    let result
    try {
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

    return NextResponse.json({
      storyId,
      currentStory: story,
      ...result
    })
  } catch (error: any) {
    console.error('Story analysis error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT: Apply story updates
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { version, updates } = body

    if (!version || !updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'version and updates array required' }, { status: 400 })
    }

    const prdFile = path.join(PRD_DIR, `${version}.json`)
    const prdContent = await fs.readFile(prdFile, 'utf-8')
    const prd = JSON.parse(prdContent)

    let applied = 0
    for (const update of updates) {
      if (!update.id) continue

      const storyIndex = prd.stories.findIndex((s: any) => s.id === update.id)
      if (storyIndex >= 0) {
        if (update.acceptance) {
          prd.stories[storyIndex].acceptance = update.acceptance
        }
        if (update.intent) {
          prd.stories[storyIndex].intent = update.intent
        }
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
    console.error('Apply story updates error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
