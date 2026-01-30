/**
 * Smart Story Selection - Ported from CLI prd.elv
 *
 * Scoring model (higher = better):
 *   tree_proximity * 5.0   - Same epic (1.0), same phase (0.5), other (0.0)
 *   tag_overlap * 3.0      - Jaccard similarity with last-completed story
 *   blocker_value * 2.0    - How many stories would this unblock
 *   priority * 1.0         - User-defined priority (default 0)
 *   inverse_complexity * 0.5 - Simpler stories break ties
 */

import type { Story, PRD } from './types'

export interface StoryScore {
  storyId: string
  score: number
  proximity: number
  tagOverlap: number
  blockerValue: number
  priority: number
  inverseComplexity: number
}

/**
 * Calculate tree proximity score between two stories
 * Returns: 1.0 (same epic), 0.5 (same phase), 0.0 (different phase)
 */
export function calcTreeProximity(storyA: Story | null, storyB: Story | null): number {
  if (!storyA || !storyB) return 0.0

  if (storyA.phase === storyB.phase && storyA.epic === storyB.epic) {
    return 1.0
  } else if (storyA.phase === storyB.phase) {
    return 0.5
  }
  return 0.0
}

/**
 * Calculate Jaccard similarity between two tag sets
 * Returns: 0.0 to 1.0 (intersection / union)
 */
export function calcTagOverlap(tagsA: string[] | undefined, tagsB: string[] | undefined): number {
  const a = tagsA || []
  const b = tagsB || []

  if (a.length === 0 || b.length === 0) return 0.0

  const setB = new Set(b)

  // Intersection
  const intersection = a.filter(t => setB.has(t)).length

  // Union
  const union = new Set([...a, ...b]).size

  if (union === 0) return 0.0
  return intersection / union
}

/**
 * Count how many stories would be unblocked if this story is merged
 * Higher = more valuable to complete
 */
export function calcBlockerValue(storyId: string, allStories: Story[]): number {
  let count = 0

  for (const story of allStories) {
    if (story.id === storyId) continue
    if (story.passes) continue // Already done

    const deps = story.depends_on || []
    if (deps.includes(storyId)) {
      count++
    }
  }

  return count
}

/**
 * Estimate story complexity based on acceptance criteria count
 * Returns inverse: simpler = higher score (for tie-breaking)
 */
export function calcInverseComplexity(story: Story): number {
  const acCount = story.acceptance?.length || 0
  if (acCount === 0) return 1.0
  // Normalize: 1 AC = 1.0, 10 AC = 0.1
  return 1.0 / acCount
}

/**
 * Check if a dependency is met (story is merged)
 */
export function isDependencyMet(dep: string, allStories: Story[]): boolean {
  // Handle different dependency formats
  // STORY-X.Y.Z or X.Y.Z -> specific story
  // X -> whole phase
  // X:Y -> phase:epic

  const storyMatch = dep.match(/^(?:STORY-)?(\d+\.\d+\.\d+)$/)
  if (storyMatch) {
    const storyId = storyMatch[1]
    const story = allStories.find(s => s.id === storyId || s.id === `STORY-${storyId}`)
    return story?.merged === true
  }

  const phaseEpicMatch = dep.match(/^(\d+):(\d+)$/)
  if (phaseEpicMatch) {
    const [, phase, epic] = phaseEpicMatch
    const phaseStories = allStories.filter(
      s => s.phase === parseInt(phase) && s.epic === parseInt(epic)
    )
    return phaseStories.every(s => s.merged === true)
  }

  const phaseMatch = dep.match(/^(\d+)$/)
  if (phaseMatch) {
    const phase = parseInt(phaseMatch[1])
    const phaseStories = allStories.filter(s => s.phase === phase)
    return phaseStories.every(s => s.merged === true)
  }

  // Unknown format - treat as not met
  return false
}

/**
 * Check if all dependencies for a story are met
 */
export function areAllDependenciesMet(story: Story, allStories: Story[]): boolean {
  const deps = story.depends_on || []
  return deps.every(dep => isDependencyMet(dep, allStories))
}

/**
 * Get all runnable stories (not passed, deps met)
 */
export function getRunnableStories(prd: PRD): Story[] {
  return prd.stories.filter(story => {
    if (story.passes) return false
    if (story.skipped) return false
    return areAllDependenciesMet(story, prd.stories)
  })
}

/**
 * Calculate composite score for a story
 */
export function scoreStory(
  story: Story,
  lastCompleted: Story | null,
  allStories: Story[]
): StoryScore {
  // Tree proximity: same epic/phase as last completed
  const proximity = calcTreeProximity(story, lastCompleted)

  // Tag overlap with last completed
  const tagOverlap = calcTagOverlap(story.tags, lastCompleted?.tags)

  // Blocker value: how many stories depend on this one
  const blockerValue = calcBlockerValue(story.id, allStories)
  // Normalize to 0-1 range (assume max 10 dependents)
  const blockerScore = Math.min(blockerValue / 10, 1.0)

  // User priority (normalize to 0-1, assume max priority 10)
  const priority = story.priority || 0
  const priorityScore = Math.min(priority / 10, 1.0)

  // Inverse complexity (simpler = higher)
  const inverseComplexity = calcInverseComplexity(story)

  // Weighted sum
  const score = (
    proximity * 5.0 +
    tagOverlap * 3.0 +
    blockerScore * 2.0 +
    priorityScore * 1.0 +
    inverseComplexity * 0.5
  )

  return {
    storyId: story.id,
    score,
    proximity,
    tagOverlap,
    blockerValue,
    priority,
    inverseComplexity
  }
}

/**
 * Get the next story to work on using smart selection
 */
export function getNextStory(prd: PRD, lastCompletedId?: string | null): Story | null {
  const runnable = getRunnableStories(prd)

  if (runnable.length === 0) return null
  if (runnable.length === 1) return runnable[0]

  // Find last completed story object
  const lastCompleted = lastCompletedId
    ? prd.stories.find(s => s.id === lastCompletedId) || null
    : null

  // Score all candidates
  let bestStory: Story | null = null
  let bestScore = -1

  for (const story of runnable) {
    const result = scoreStory(story, lastCompleted, prd.stories)
    if (result.score > bestScore) {
      bestScore = result.score
      bestStory = story
    }
  }

  return bestStory
}

/**
 * Get scored list of all runnable stories (for display)
 */
export function getScoredStories(prd: PRD, lastCompletedId?: string | null): StoryScore[] {
  const runnable = getRunnableStories(prd)

  const lastCompleted = lastCompletedId
    ? prd.stories.find(s => s.id === lastCompletedId) || null
    : null

  const scores = runnable.map(story =>
    scoreStory(story, lastCompleted, prd.stories)
  )

  // Sort by score descending
  return scores.sort((a, b) => b.score - a.score)
}
