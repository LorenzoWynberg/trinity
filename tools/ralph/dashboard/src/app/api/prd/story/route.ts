import { NextRequest, NextResponse } from 'next/server'
import { runClaude } from '@/lib/claude'
import * as prdDb from '@/lib/db/prd'

// POST: Analyze requested changes and check related stories
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { version, storyId, requestedChanges } = body

    if (!version || !storyId || !requestedChanges) {
      return NextResponse.json({ error: 'version, storyId, and requestedChanges are required' }, { status: 400 })
    }

    const prd = prdDb.getPRD(version)
    if (!prd) {
      return NextResponse.json({ error: `Version ${version} not found` }, { status: 404 })
    }

    const story = prd.stories.find((s) => s.id === storyId)
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    // Find related stories (same tags, dependents, dependencies)
    const storyTags = new Set(story.tags || [])
    const relatedStories = prd.stories.filter((s) => {
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

TARGET STORY:
- ID: ${story.id}
- Title: ${story.title}
- Current Description: ${story.description || '(none)'}
- Current Intent: ${story.intent || '(none)'}
- Tags: ${(story.tags || []).join(', ') || '(none)'}
- Depends On: ${(story.depends_on || []).join(', ') || '(none)'}

Current Acceptance Criteria:
${(story.acceptance || []).map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}

USER REQUESTED CHANGES:
${requestedChanges}

RELATED STORIES (share tags or dependencies - may need updates for consistency):
${JSON.stringify(relatedStories.map((s) => ({
  id: s.id,
  title: s.title,
  description: s.description,
  tags: s.tags,
  depends_on: s.depends_on,
  acceptance: s.acceptance
})), null, 2)}

Tasks:
1. Generate updated description and acceptance criteria for the target story
2. Check if any related stories need updates to stay consistent
3. Be specific - avoid vague terms like "properly", "handle", "settings"

Output ONLY valid JSON (no markdown, no code blocks):
{
  "target": {
    "suggested_description": "Updated description based on changes",
    "suggested_acceptance": ["specific criterion 1", "specific criterion 2"],
    "suggested_intent": "Updated intent if needed"
  },
  "related_updates": [
    {
      "id": "X.Y.Z",
      "reason": "Why this story needs updating due to changes in ${storyId}",
      "suggested_description": "Updated description if changed",
      "suggested_acceptance": ["updated criteria if changed"]
    }
  ],
  "summary": "Brief description of what changed and why"
}

Only include related_updates for stories that actually need changes.`

    // Run Claude with temp files
    const { success, result, error, raw } = await runClaude(prompt)

    if (!success) {
      return NextResponse.json({ error, raw }, { status: 500 })
    }

    // Enrich related_updates with title from original stories
    const enrichedRelatedUpdates = (result.related_updates || []).map((update: any) => {
      const originalStory = relatedStories.find((s) => s.id === update.id)
      return {
        ...update,
        title: originalStory?.title || update.title
      }
    })

    return NextResponse.json({
      storyId,
      currentStory: story,
      relatedStories: relatedStories.map((s) => ({ id: s.id, title: s.title })),
      target: result.target,
      related_updates: enrichedRelatedUpdates,
      summary: result.summary
    })
  } catch (error: any) {
    console.error('Story analysis error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT: Apply story updates to database
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { version, updates } = body

    if (!version || !updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'version and updates array required' }, { status: 400 })
    }

    let applied = 0
    for (const update of updates) {
      const story = prdDb.stories.get(update.id)
      if (!story) continue

      const changes: any = {}
      if (update.suggested_description) {
        changes.description = update.suggested_description
      }
      if (update.suggested_acceptance) {
        changes.acceptance = update.suggested_acceptance
      }
      if (update.suggested_intent) {
        changes.intent = update.suggested_intent
      }

      if (Object.keys(changes).length > 0) {
        prdDb.stories.update(update.id, changes)
        applied++
      }
    }

    return NextResponse.json({
      applied,
      success: true
    })
  } catch (error: any) {
    console.error('Apply story updates error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
