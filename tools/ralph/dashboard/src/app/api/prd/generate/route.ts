import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { runClaude, PRD_DIR } from '@/lib/claude'

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

// PUT: Have Claude add generated stories to PRD
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { version, stories } = body

    if (!version || !stories || !Array.isArray(stories)) {
      return NextResponse.json({ error: 'version and stories array required' }, { status: 400 })
    }

    const prdFile = path.join(PRD_DIR, `${version}.json`)

    // Build prompt for Claude to add the stories
    const prompt = `You need to add new stories to the PRD file.

PRD FILE: ${prdFile}
TARGET VERSION: ${version}

NEW STORIES TO ADD:
${JSON.stringify(stories, null, 2)}

Instructions:
1. Read the PRD file at the path above
2. For each new story:
   - Determine the next story_number for its phase.epic combination
   - Generate the ID as "{phase}.{epic}.{story_number}"
   - Add all required fields: id, title, intent, acceptance, phase, epic, story_number, target_version, depends_on, tags, passes (false), merged (false)
3. Sort all stories by phase, then epic, then story_number
4. Write the updated PRD back to the same file

After completing, output this JSON:
{
  "added": <number of stories added>,
  "success": true
}`

    const { success, result, error, raw } = await runClaude(prompt, { timeoutMs: 60000 })

    if (!success) {
      return NextResponse.json({ error, raw }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Add stories error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
