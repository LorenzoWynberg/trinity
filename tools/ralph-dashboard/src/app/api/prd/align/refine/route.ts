import { NextRequest, NextResponse } from 'next/server'
import { runClaude } from '@/lib/claude'
import * as prdDb from '@/lib/db/prd'

// POST: Refine alignment analysis with additional user input
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { version, previousAnalysis, additionalInput, scope, scopeId } = body

    if (!version || !previousAnalysis || !additionalInput) {
      return NextResponse.json(
        { error: 'version, previousAnalysis, and additionalInput are required' },
        { status: 400 }
      )
    }

    const prd = prdDb.getPRD(version)
    if (!prd) {
      return NextResponse.json({ error: `Version ${version} not found` }, { status: 404 })
    }

    // Get stories based on scope (same logic as align task)
    let stories = prd.stories
    let scopeDescription = ''

    if (scope === 'phase' && scopeId) {
      const phaseNum = parseInt(scopeId, 10)
      stories = stories.filter(s => s.phase === phaseNum)
      const phase = prd.phases?.find(p => p.id === phaseNum)
      scopeDescription = `Phase ${phaseNum}${phase ? `: ${phase.name}` : ''}`
    } else if (scope === 'epic' && scopeId) {
      const [phaseStr, epicStr] = scopeId.split('.')
      const phaseNum = parseInt(phaseStr, 10)
      const epicNum = parseInt(epicStr, 10)
      stories = stories.filter(s => s.phase === phaseNum && s.epic === epicNum)
      const phase = prd.phases?.find(p => p.id === phaseNum)
      const epic = prd.epics?.find(e => e.phase === phaseNum && e.id === epicNum)
      scopeDescription = `Phase ${phaseNum}${phase ? ` (${phase.name})` : ''}, Epic ${epicNum}${epic ? `: ${epic.name}` : ''}`
    } else {
      scopeDescription = `Full version: ${version}`
    }

    const incompleteStories = stories.filter(s => !s.passes && !s.merged && !s.skipped)

    const prompt = `You are refining an alignment analysis based on additional user feedback.

## Original Vision
${previousAnalysis.vision}

## Scope: ${scope}
${scopeDescription}

## Previous Analysis
Alignment Score: ${previousAnalysis.alignment_score}/100
Summary: ${previousAnalysis.summary}

Gaps identified: ${JSON.stringify(previousAnalysis.gaps || [], null, 2)}
Misalignments: ${JSON.stringify(previousAnalysis.misalignments || [], null, 2)}
Suggested modifications: ${JSON.stringify(previousAnalysis.modifications || [], null, 2)}
Suggested new stories: ${JSON.stringify(previousAnalysis.new_stories || [], null, 2)}

## User's Additional Input/Feedback
${additionalInput}

## Current Stories (${incompleteStories.length} incomplete)
${JSON.stringify(incompleteStories.map(s => ({
  id: s.id,
  title: s.title,
  intent: s.intent,
  description: s.description,
  acceptance: s.acceptance,
  phase: s.phase,
  epic: s.epic,
  tags: s.tags,
  depends_on: s.depends_on
})), null, 2)}

## Task
Refine your analysis based on the user's feedback. They may want you to:
- Focus on specific areas
- Reconsider certain suggestions
- Add more detail to suggestions
- Remove suggestions they don't agree with
- Explore different approaches

Output an updated analysis in the same JSON format:

{
  "alignment_score": 0-100,
  "summary": "Updated assessment",
  "gaps": [...],
  "misalignments": [...],
  "modifications": [...],
  "new_stories": [...]
}

Be responsive to the user's feedback while maintaining alignment with the original vision.`

    const { success, result, error, raw } = await runClaude(prompt)

    if (!success) {
      return NextResponse.json({ error, raw }, { status: 500 })
    }

    return NextResponse.json({
      ...result,
      scope,
      scopeId,
      scopeDescription,
      vision: previousAnalysis.vision,
      analyzedCount: incompleteStories.length
    })
  } catch (error: any) {
    console.error('Refine align error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
