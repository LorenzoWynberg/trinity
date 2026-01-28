import { NextRequest, NextResponse } from 'next/server'
import { runClaude } from '@/lib/claude'

// POST: Refine acceptance criteria based on user prompt
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { storyId, currentAcceptance, prompt } = body

    if (!storyId || !currentAcceptance || !prompt) {
      return NextResponse.json(
        { error: 'storyId, currentAcceptance, and prompt are required' },
        { status: 400 }
      )
    }

    const claudePrompt = `You are refining acceptance criteria for a PRD story.

STORY ID: ${storyId}

CURRENT ACCEPTANCE CRITERIA:
${currentAcceptance.map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}

USER REQUEST:
${prompt}

Update the acceptance criteria based on the user's request. Keep criteria specific and testable.

Output format (JSON only, no markdown):
{
  "acceptance": ["updated criterion 1", "updated criterion 2", "..."]
}`

    const { success, result, error, raw } = await runClaude(claudePrompt, { timeoutMs: 60000 })

    if (!success) {
      return NextResponse.json({ error, raw }, { status: 500 })
    }

    return NextResponse.json({ acceptance: result.acceptance })
  } catch (error: any) {
    console.error('Refine edit error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
