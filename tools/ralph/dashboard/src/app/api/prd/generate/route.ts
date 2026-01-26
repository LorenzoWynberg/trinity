import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'

const execAsync = promisify(exec)

const PROJECT_ROOT = path.join(process.cwd(), '../../../..')
const RALPH_CLI_DIR = path.join(PROJECT_ROOT, 'tools/ralph/cli')
const PRD_DIR = path.join(RALPH_CLI_DIR, 'prd')

// POST: Generate stories from description
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { version, description } = body

    if (!version || !description) {
      return NextResponse.json({ error: 'version and description are required' }, { status: 400 })
    }

    const prdFile = path.join(PRD_DIR, `${version}.json`)
    const prdContent = await fs.readFile(prdFile, 'utf-8')
    const prd = JSON.parse(prdContent)

    const existingStories = prd.stories.map((s: any) => ({
      id: s.id,
      title: s.title,
      phase: s.phase,
      epic: s.epic,
      tags: s.tags
    }))

    // Build prompt
    const prompt = `You are creating PRD stories for an existing project.

PROJECT: ${prd.project || 'Unknown'}
TARGET VERSION: ${version}

EXISTING PHASES:
${JSON.stringify(prd.phases || [], null, 2)}

EXISTING EPICS:
${JSON.stringify(prd.epics || [], null, 2)}

EXISTING STORIES (for context and avoiding duplicates):
${JSON.stringify(existingStories, null, 2)}

USER REQUEST:
${description}

Generate new stories that:
1. Fit into existing phases/epics OR suggest new epic if needed
2. Have specific, testable acceptance criteria
3. Include proper dependencies on existing stories
4. Avoid duplicating existing functionality
5. Are small enough to implement in one session

Output ONLY valid JSON (no markdown, no code blocks):
{
  "stories": [
    {
      "title": "Clear action-oriented title",
      "intent": "Why this story matters",
      "acceptance": ["Specific criterion 1", "Specific criterion 2"],
      "phase": 1,
      "epic": 1,
      "depends_on": ["X.Y.Z"],
      "tags": ["relevant", "tags"]
    }
  ],
  "new_epic": {
    "needed": false,
    "phase": 1,
    "name": "Epic Name",
    "description": "What this epic covers"
  },
  "reasoning": "Brief explanation of how stories fit the request"
}

Be specific in acceptance criteria - avoid vague terms.`

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

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Generate error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT: Add generated stories to PRD
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { version, stories } = body

    if (!version || !stories || !Array.isArray(stories)) {
      return NextResponse.json({ error: 'version and stories array required' }, { status: 400 })
    }

    const prdFile = path.join(PRD_DIR, `${version}.json`)
    const prdContent = await fs.readFile(prdFile, 'utf-8')
    const prd = JSON.parse(prdContent)

    let added = 0
    for (const story of stories) {
      if (!story.title || !story.phase || !story.epic) continue

      // Get next story number for this phase.epic
      const existing = prd.stories.filter(
        (s: any) => s.phase === story.phase && s.epic === story.epic
      )
      const maxNum = existing.length > 0
        ? Math.max(...existing.map((s: any) => s.story_number || 0))
        : 0
      const storyNum = maxNum + 1
      const newId = `${story.phase}.${story.epic}.${storyNum}`

      prd.stories.push({
        id: newId,
        title: story.title,
        intent: story.intent || '',
        acceptance: story.acceptance || [],
        phase: story.phase,
        epic: story.epic,
        story_number: storyNum,
        target_version: version,
        depends_on: story.depends_on || [],
        tags: story.tags || [],
        passes: false,
        merged: false
      })
      added++
    }

    // Sort stories
    prd.stories.sort((a: any, b: any) => {
      if (a.phase !== b.phase) return a.phase - b.phase
      if (a.epic !== b.epic) return a.epic - b.epic
      return a.story_number - b.story_number
    })

    await fs.writeFile(prdFile, JSON.stringify(prd, null, 2))

    return NextResponse.json({ success: true, added })
  } catch (error: any) {
    console.error('Add stories error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
