import type { PRD, PhaseProgress, EpicProgress, Story, Metrics, BlockedInfo } from '../types'

// Computed data helpers
export function getPhaseProgress(prd: PRD): PhaseProgress[] {
  const phases = new Map<number, PhaseProgress>()

  // Build phase name lookup
  const phaseNames = new Map<number, string>()
  if (prd.phases) {
    for (const p of prd.phases) {
      phaseNames.set(p.id, p.name)
    }
  }

  for (const story of prd.stories) {
    if (!phases.has(story.phase)) {
      phases.set(story.phase, {
        phase: story.phase,
        name: phaseNames.get(story.phase),
        total: 0,
        merged: 0,
        passed: 0,
        skipped: 0,
        percentage: 0
      })
    }

    const p = phases.get(story.phase)!
    p.total++
    if (story.merged) p.merged++
    if (story.passes && !story.merged) p.passed++
    if (story.skipped) p.skipped++
  }

  for (const p of phases.values()) {
    p.percentage = p.total > 0 ? Math.round((p.merged / p.total) * 100) : 0
  }

  return Array.from(phases.values()).sort((a, b) => a.phase - b.phase)
}

export function getEpicProgress(prd: PRD): EpicProgress[] {
  const epics = new Map<string, EpicProgress>()

  // Build name lookups
  const phaseNames = new Map<number, string>()
  const epicNames = new Map<string, string>()
  if (prd.phases) {
    for (const p of prd.phases) {
      phaseNames.set(p.id, p.name)
    }
  }
  if (prd.epics) {
    for (const e of prd.epics) {
      epicNames.set(`${e.phase}-${e.id}`, e.name)
    }
  }

  for (const story of prd.stories) {
    const key = `${story.phase}-${story.epic}`
    if (!epics.has(key)) {
      epics.set(key, {
        phase: story.phase,
        epic: story.epic,
        phaseName: phaseNames.get(story.phase),
        epicName: epicNames.get(key),
        total: 0,
        merged: 0,
        stories: []
      })
    }

    const e = epics.get(key)!
    e.total++
    if (story.merged) e.merged++
    e.stories.push(story)
  }

  return Array.from(epics.values()).sort((a, b) => {
    if (a.phase !== b.phase) return a.phase - b.phase
    return a.epic - b.epic
  })
}

export function getStoryById(prd: PRD, id: string): Story | undefined {
  return prd.stories.find(s => s.id === id)
}

export function getTotalStats(prd: PRD, metrics: Metrics | null) {
  const total = prd.stories.length
  const merged = prd.stories.filter(s => s.merged).length
  const passed = prd.stories.filter(s => s.passes && !s.merged).length
  const skipped = prd.stories.filter(s => s.skipped).length

  return {
    total,
    merged,
    passed,
    skipped,
    remaining: total - merged - skipped,
    percentage: total > 0 ? Math.round((merged / total) * 100) : 0,
    totalTokens: metrics?.total_tokens ?? 0,
    totalDuration: metrics?.total_duration_seconds ?? 0
  }
}

// Check if a dependency is met (story is merged)
function isDepMet(prd: PRD, dep: string): boolean {
  // Handle X.Y.Z format (short story ID like "1.1.1")
  if (/^\d+\.\d+\.\d+$/.test(dep)) {
    const story = prd.stories.find(s => s.id === dep)
    return story?.merged === true
  }
  // Handle STORY-X.Y.Z format
  if (dep.startsWith('STORY-')) {
    const id = dep.replace('STORY-', '')
    const story = prd.stories.find(s => s.id === id)
    return story?.merged === true
  }
  // Handle phase:epic format (e.g., "1:2")
  if (dep.includes(':')) {
    const [phase, epic] = dep.split(':').map(Number)
    const stories = prd.stories.filter(s => s.phase === phase && s.epic === epic)
    return stories.length > 0 && stories.every(s => s.merged)
  }
  // Handle phase only (e.g., "1")
  const phase = parseInt(dep)
  if (!isNaN(phase)) {
    const stories = prd.stories.filter(s => s.phase === phase)
    return stories.length > 0 && stories.every(s => s.merged)
  }
  return false
}

// Check if a story is blocked (has unmet dependencies)
function isStoryBlocked(prd: PRD, story: Story): boolean {
  if (!story.depends_on || story.depends_on.length === 0) return false
  return story.depends_on.some(dep => !isDepMet(prd, dep))
}

// Find a story by dependency string (handles both "1.1.1" and "STORY-1.1.1" formats)
function findStoryByDep(prd: PRD, dep: string): Story | undefined {
  // Check if it's a story reference (X.Y.Z format)
  if (/^\d+\.\d+\.\d+$/.test(dep)) {
    return prd.stories.find(s => s.id === dep)
  }
  // Check STORY-X.Y.Z format
  if (dep.startsWith('STORY-')) {
    const id = dep.replace('STORY-', '')
    return prd.stories.find(s => s.id === id)
  }
  return undefined
}

// Get stories that are blocked by unmerged dependencies
// Only returns "first generation" blocked - stories whose blocker is NOT itself blocked
// This shows the immediate next row, not transitive chains
export function getBlockedStories(prd: PRD): BlockedInfo[] {
  const blocked: BlockedInfo[] = []

  for (const story of prd.stories) {
    // Skip if already passed, merged, or skipped
    if (story.passes || story.merged || story.skipped) continue

    // Check dependencies
    if (story.depends_on && story.depends_on.length > 0) {
      for (const dep of story.depends_on) {
        if (!isDepMet(prd, dep)) {
          const blockerStory = findStoryByDep(prd, dep)
          if (blockerStory) {
            // First gen: blocker must NOT be blocked itself (it's either in progress, pending with no deps, or passed)
            if (!isStoryBlocked(prd, blockerStory)) {
              blocked.push({
                story,
                blockedBy: dep,
                blockerStory
              })
              break
            }
          }
          // For phase/epic deps, skip for now (complex to determine first-gen)
        }
      }
    }
  }

  return blocked.slice(0, 5) // Limit to 5 for dashboard
}

// Get stories that passed but haven't been merged yet
export function getUnmergedPassed(prd: PRD): Story[] {
  return prd.stories.filter(s => s.passes && !s.merged)
}
