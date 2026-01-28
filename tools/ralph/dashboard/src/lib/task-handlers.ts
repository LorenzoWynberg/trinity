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

  const { success, result, error, raw } = await runClaude(prompt)

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
  const { storyId, requestedChanges, story, relatedStories } = params
  const prdFile = path.join(PRD_DIR, `${version}.json`)

  const prompt = `You are refining a PRD story based on user feedback.

STORY TO UPDATE:
ID: ${story.id}
Title: ${story.title}
Current Description: ${story.description || 'None'}
Current Acceptance: ${JSON.stringify(story.acceptance)}
Tags: ${JSON.stringify(story.tags || [])}
Depends On: ${JSON.stringify(story.depends_on || [])}

USER REQUESTED CHANGES:
${requestedChanges}

RELATED STORIES (share tags or dependencies):
${relatedStories?.map((s: any) => `- ${s.id}: ${s.title} [tags: ${s.tags?.join(', ')}]`).join('\n') || 'None'}

Analyze the requested changes and suggest updates. Output JSON:
{
  "target": {
    "suggested_description": "Updated description",
    "suggested_acceptance": ["Criterion 1", "Criterion 2"]
  },
  "related_updates": [
    {
      "id": "X.Y.Z",
      "title": "Story title",
      "reason": "Why this needs updating",
      "suggested_description": "Updated description",
      "suggested_acceptance": ["Criterion 1"]
    }
  ],
  "summary": "Brief summary of changes"
}

Only include related_updates if changes to target genuinely affect them.`

  const { success, result, error } = await runClaude(prompt)

  if (!success) {
    throw new Error(error || 'Claude failed')
  }

  return { ...result, storyId, currentStory: story, relatedStories }
}
