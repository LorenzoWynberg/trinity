import { NextRequest, NextResponse } from 'next/server'
import { runClaude } from '@/lib/claude'
import { getPrompt } from '@/lib/prompts'

type Refinement = {
  id: string
  title: string
  status: 'ok' | 'needs_work'
  issues: string[]
  suggested_description: string
  suggested_acceptance: string[]
  tags?: string[]
  depends_on?: string[]
}

// Find related stories based on tags and dependencies
function findRelatedStories(
  targetId: string,
  targetTags: string[],
  targetDependsOn: string[],
  allRefinements: Refinement[]
): Refinement[] {
  const targetTagSet = new Set(targetTags || [])

  return allRefinements.filter(r => {
    if (r.id === targetId) return false

    // Check tag overlap (at least 1 shared tag)
    const overlap = (r.tags || []).filter(t => targetTagSet.has(t))
    if (overlap.length >= 1) return true

    // Check if this story depends on target
    if ((r.depends_on || []).includes(targetId)) return true

    // Check if target depends on this story
    if ((targetDependsOn || []).includes(r.id)) return true

    return false
  })
}

// POST: Regenerate suggestions for a story and check related stories
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      storyId,
      title,
      currentDescription,
      currentAcceptance,
      userFeedback,
      tags,
      depends_on,
      allRefinements  // Pass all current refinements to check for related
    } = body

    if (!storyId || !userFeedback) {
      return NextResponse.json(
        { error: 'storyId and userFeedback are required' },
        { status: 400 }
      )
    }

    // Find related stories that might be affected
    const relatedStories = allRefinements
      ? findRelatedStories(storyId, tags || [], depends_on || [], allRefinements)
      : []

    const hasRelated = relatedStories.length > 0

    const prompt = getPrompt('refine-edit', {
      STORY_ID: storyId,
      TITLE: title || 'Unknown',
      TAGS: (tags || []).join(', ') || '(none)',
      DEPENDS_ON: (depends_on || []).join(', ') || '(none)',
      CURRENT_DESCRIPTION: currentDescription || '(none)',
      CURRENT_ACCEPTANCE: (currentAcceptance || []).map((a: string, i: number) => `${i + 1}. ${a}`).join('\n'),
      USER_FEEDBACK: userFeedback,
      RELATED_STORIES_SECTION: hasRelated ? `
RELATED STORIES (share tags or dependencies - check if they need updates):
${JSON.stringify(relatedStories.map(r => ({
  id: r.id,
  title: r.title,
  tags: r.tags,
  depends_on: r.depends_on,
  current_description: r.suggested_description,
  current_acceptance: r.suggested_acceptance
})), null, 2)}
` : '',
      RELATED_CHECK_INSTRUCTION: hasRelated
        ? 'Check if any related stories need updated suggestions due to this change'
        : 'No related stories to check',
      RELATED_OUTPUT_SCHEMA: hasRelated ? `,
  "related_updates": [
    {
      "id": "X.Y.Z",
      "reason": "Why this needs updating",
      "suggested_description": "Updated description if changed",
      "suggested_acceptance": ["updated criteria if changed"]
    }
  ]` : ''
    })

    const { success, result, error, raw } = await runClaude(prompt)

    if (!success) {
      return NextResponse.json({ error, raw }, { status: 500 })
    }

    return NextResponse.json({
      target: {
        id: storyId,
        suggested_description: result.target?.suggested_description,
        suggested_acceptance: result.target?.suggested_acceptance
      },
      related_updates: result.related_updates || []
    })
  } catch (error: any) {
    console.error('Refine edit error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
