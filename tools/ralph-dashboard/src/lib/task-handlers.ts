import { runClaude } from './claude'
import * as prd from './db/prd'
import type { Task } from './tasks'
import type { Story } from './types'

export async function runRefineTask(task: Task): Promise<any> {
  const { version } = task
  const prdData = prd.getPRD(version)
  if (!prdData) {
    throw new Error(`Version ${version} not found`)
  }

  // Get incomplete stories
  const incompleteStories = prdData.stories.filter(
    s => !s.passes && !s.merged && !s.skipped
  )

  const prompt = `Review these stories for clarity and testability:

STORIES TO REVIEW:
${JSON.stringify(incompleteStories.map(s => ({
  id: s.id,
  title: s.title,
  description: s.description,
  acceptance: s.acceptance,
  tags: s.tags,
  depends_on: s.depends_on
})), null, 2)}

For each story, check:
1. Are acceptance criteria specific and testable?
2. Are there vague terms? ("settings", "improve", "properly", "handle")
3. Should it be split into smaller stories?

Output JSON:
{
  "refinements": [
    {
      "id": "X.Y.Z",
      "title": "story title",
      "status": "ok" | "needs_work",
      "issues": ["issue 1"],
      "suggested_description": "clearer description",
      "suggested_acceptance": ["criterion 1", "criterion 2"],
      "tags": ["from", "original"],
      "depends_on": ["from", "original"]
    }
  ],
  "summary": "X of Y stories need refinement"
}

Copy tags and depends_on from original. Be pragmatic - only flag real issues.`

  const { success, result, error } = await runClaude(prompt)

  if (!success) {
    throw new Error(error || 'Claude failed')
  }

  return result
}

export async function runGenerateTask(task: Task): Promise<any> {
  const { version, params } = task
  const { description } = params
  const prdData = prd.getPRD(version)
  if (!prdData) {
    throw new Error(`Version ${version} not found`)
  }

  // Build context
  const phases = prdData.phases?.map((p) => `${p.id}. ${p.name}`).join(', ') || 'No phases defined'
  const epics = prdData.epics?.map((e) => `Phase ${e.phase}, Epic ${e.id}: ${e.name}`).join('\n') || 'No epics defined'
  const existingStories = prdData.stories?.slice(0, 10).map((s) => `${s.id}: ${s.title}`).join('\n') || ''

  const prompt = `You are helping build a PRD. Here's the context:

PROJECT: ${prdData.project}
PHASES: ${phases}
EPICS:
${epics}

EXISTING STORIES (sample):
${existingStories}

USER REQUEST:
${description}

Generate new stories that fit this PRD. Output JSON:
{
  "stories": [
    {
      "title": "Story title",
      "intent": "Why this matters",
      "acceptance": ["Criterion 1", "Criterion 2"],
      "phase": 1,
      "epic": 1,
      "depends_on": [],
      "tags": ["tag1"]
    }
  ],
  "new_epic": { "phase": 1, "name": "Epic name" } | null,
  "reasoning": "Brief explanation of choices"
}

Be specific with acceptance criteria. Match existing style.`

  const { success, result, error } = await runClaude(prompt)

  if (!success) {
    throw new Error(error || 'Claude failed')
  }

  return result
}

export async function runStoryEditTask(task: Task): Promise<any> {
  const { version, params } = task
  const { storyId, requestedChanges } = params
  const prdData = prd.getPRD(version)
  if (!prdData) {
    throw new Error(`Version ${version} not found`)
  }

  const story = prdData.stories.find((s) => s.id === storyId)
  if (!story) {
    throw new Error(`Story ${storyId} not found`)
  }

  // Find related stories (same tags, dependents, dependencies)
  const storyTags = new Set(story.tags || [])
  const relatedStories = prdData.stories.filter((s) => {
    if (s.id === storyId) return false
    const overlap = (s.tags || []).filter((t: string) => storyTags.has(t))
    if (overlap.length >= 2) return true
    if (s.depends_on?.includes(storyId)) return true
    if (story.depends_on?.includes(s.id)) return true
    return false
  })

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

  const { success, result, error } = await runClaude(prompt)

  if (!success) {
    throw new Error(error || 'Claude failed')
  }

  // Enrich related_updates with title from original stories
  const enrichedRelatedUpdates = (result.related_updates || []).map((update: any) => {
    const originalStory = relatedStories.find((s) => s.id === update.id)
    return {
      ...update,
      title: originalStory?.title || update.title
    }
  })

  return {
    storyId,
    currentStory: story,
    relatedStories: relatedStories.map((s) => ({ id: s.id, title: s.title })),
    target: result.target,
    related_updates: enrichedRelatedUpdates,
    summary: result.summary
  }
}

export async function runAlignTask(task: Task): Promise<any> {
  const { version, params } = task
  const { scope, scopeId, vision } = params
  // scope: 'project' | 'version' | 'phase' | 'epic'
  // scopeId: version id, phase number, or "phase.epic"
  // vision: user's description of what they want

  const prdData = prd.getPRD(version)
  if (!prdData) {
    throw new Error(`Version ${version} not found`)
  }

  // Get stories based on scope
  let stories: Story[] = prdData.stories
  let scopeDescription = ''

  if (scope === 'phase' && scopeId) {
    const phaseNum = parseInt(scopeId, 10)
    stories = stories.filter(s => s.phase === phaseNum)
    const phase = prdData.phases?.find(p => p.id === phaseNum)
    scopeDescription = `Phase ${phaseNum}${phase ? `: ${phase.name}` : ''}`
  } else if (scope === 'epic' && scopeId) {
    const [phaseStr, epicStr] = scopeId.split('.')
    const phaseNum = parseInt(phaseStr, 10)
    const epicNum = parseInt(epicStr, 10)
    stories = stories.filter(s => s.phase === phaseNum && s.epic === epicNum)
    const phase = prdData.phases?.find(p => p.id === phaseNum)
    const epic = prdData.epics?.find(e => e.phase === phaseNum && e.id === epicNum)
    scopeDescription = `Phase ${phaseNum}${phase ? ` (${phase.name})` : ''}, Epic ${epicNum}${epic ? `: ${epic.name}` : ''}`
  } else {
    scopeDescription = `Full version: ${version}`
  }

  // Filter to incomplete stories for analysis
  const incompleteStories = stories.filter(s => !s.passes && !s.merged && !s.skipped)

  const prompt = `You are analyzing a PRD for alignment with the user's vision.

## User's Vision
${vision}

## Scope: ${scope}
${scopeDescription}

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

## Analysis Required

Analyze how well the current stories align with the user's vision. Consider:

1. **Coverage**: Do the stories fully cover what's needed to achieve the vision?
2. **Gaps**: What capabilities or features are missing?
3. **Misalignments**: Are there stories that don't serve the vision or seem out of scope?
4. **Priority**: Are the most important aspects of the vision well-represented?

## Output JSON

{
  "alignment_score": 0-100,
  "summary": "Brief overall assessment of alignment",
  "gaps": [
    {
      "description": "What's missing",
      "priority": "high" | "medium" | "low",
      "suggested_stories": [
        {
          "title": "Story title",
          "intent": "Why this story matters",
          "acceptance": ["Criterion 1", "Criterion 2"],
          "phase": 1,
          "epic": 1
        }
      ]
    }
  ],
  "misalignments": [
    {
      "story_id": "X.Y.Z",
      "title": "Story title",
      "issue": "Why this story doesn't align with the vision",
      "suggestion": "remove" | "modify" | "keep"
    }
  ],
  "modifications": [
    {
      "story_id": "X.Y.Z",
      "current_title": "Current title",
      "suggested_title": "Better title if needed",
      "suggested_intent": "Updated intent",
      "suggested_acceptance": ["Updated criterion 1", "Updated criterion 2"],
      "reason": "Why this modification improves alignment"
    }
  ],
  "new_stories": [
    {
      "title": "Story title",
      "intent": "Why this matters for the vision",
      "acceptance": ["Specific criterion 1", "Specific criterion 2"],
      "phase": 1,
      "epic": 1,
      "priority": "high" | "medium" | "low",
      "gap_reference": "Which gap this addresses"
    }
  ]
}

Be pragmatic and specific:
- Only flag real issues that impact the vision
- Suggest concrete, actionable changes
- Use specific acceptance criteria (avoid vague terms like "properly", "handle", "settings")
- Keep story titles concise and action-oriented`

  const { success, result, error } = await runClaude(prompt)

  if (!success) {
    throw new Error(error || 'Claude failed')
  }

  return {
    ...result,
    scope,
    scopeId,
    scopeDescription,
    vision,
    analyzedCount: incompleteStories.length
  }
}
