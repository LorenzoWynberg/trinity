import { NextRequest, NextResponse } from 'next/server'
import { runClaude } from '@/lib/claude'

// POST: Regenerate suggestions for a single story based on user feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { storyId, title, currentDescription, currentAcceptance, userFeedback } = body

    if (!storyId || !userFeedback) {
      return NextResponse.json(
        { error: 'storyId and userFeedback are required' },
        { status: 400 }
      )
    }

    const claudePrompt = `You are refining suggestions for a PRD story based on user feedback.

STORY ID: ${storyId}
STORY TITLE: ${title || 'Unknown'}

CURRENT SUGGESTED DESCRIPTION:
${currentDescription || '(none)'}

CURRENT SUGGESTED ACCEPTANCE CRITERIA:
${(currentAcceptance || []).map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}

USER FEEDBACK:
${userFeedback}

Based on the user's feedback, generate improved suggestions. Keep them specific and testable.

Output format (JSON only, no markdown):
{
  "suggested_description": "Updated description based on feedback",
  "suggested_acceptance": ["updated criterion 1", "updated criterion 2", "..."]
}`

    const { success, result, error, raw } = await runClaude(claudePrompt, { timeoutMs: 60000 })

    if (!success) {
      return NextResponse.json({ error, raw }, { status: 500 })
    }

    return NextResponse.json({
      suggested_description: result.suggested_description,
      suggested_acceptance: result.suggested_acceptance
    })
  } catch (error: any) {
    console.error('Refine edit error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
