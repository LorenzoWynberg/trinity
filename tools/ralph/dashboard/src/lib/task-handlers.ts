import { runClaude } from './claude'
import { promises as fs } from 'fs'
import path from 'path'
import type { Task } from './tasks'

const PRD_DIR = path.join(process.cwd(), '..', 'cli', 'prd')

export async function runRefineTask(task: Task): Promise<any> {
  const { version } = task
  const prdFile = path.join(PRD_DIR, `${version}.json`)

  const prompt = `Read the PRD file at: ${prdFile}

Review all stories where passes=false AND merged=false AND skipped=false.

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
  const prdFile = path.join(PRD_DIR, `${version}.json`)

  // Read PRD for context
  const prdContent = await fs.readFile(prdFile, 'utf-8')
  const prd = JSON.parse(prdContent)

  // Build context
  const phases = prd.phases?.map((p: any) => `${p.id}. ${p.name}`).join(', ') || 'No phases defined'
  const epics = prd.epics?.map((e: any) => `Phase ${e.phase}, Epic ${e.id}: ${e.name}`).join('\n') || 'No epics defined'
  const existingStories = prd.stories?.slice(0, 10).map((s: any) => `${s.id}: ${s.title}`).join('\n') || ''

  const prompt = `You are helping build a PRD. Here's the context:

PROJECT: ${prd.project || prd.title}
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
  const prdFile = path.join(PRD_DIR, `${version}.json`)

  // Read PRD to get story and related stories
  const prdContent = await fs.readFile(prdFile, 'utf-8')
  const prd = JSON.parse(prdContent)

  const story = prd.stories.find((s: any) => s.id === storyId)
  if (!story) {
    throw new Error(`Story ${storyId} not found`)
  }

  // Find related stories (same tags, dependents, dependencies)
  const storyTags = new Set(story.tags || [])
  const relatedStories = prd.stories.filter((s: any) => {
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
${JSON.stringify(relatedStories.map((s: any) => ({
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
    const originalStory = relatedStories.find((s: any) => s.id === update.id)
    return {
      ...update,
      title: originalStory?.title || update.title
    }
  })

  return {
    storyId,
    currentStory: story,
    relatedStories: relatedStories.map((s: any) => ({ id: s.id, title: s.title })),
    target: result.target,
    related_updates: enrichedRelatedUpdates,
    summary: result.summary
  }
}
