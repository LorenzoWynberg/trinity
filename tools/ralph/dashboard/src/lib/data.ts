import fs from 'fs/promises'
import path from 'path'
import type { PRD, State, Metrics, PhaseProgress, EpicProgress, Story } from './types'

// Paths relative to project root
const PROJECT_ROOT = path.join(process.cwd(), '../../..')
const RALPH_CLI_DIR = path.join(PROJECT_ROOT, 'tools/ralph/cli')
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs')

export async function getPRD(): Promise<PRD | null> {
  try {
    const content = await fs.readFile(path.join(RALPH_CLI_DIR, 'prd.json'), 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

export async function getState(): Promise<State | null> {
  try {
    const content = await fs.readFile(path.join(RALPH_CLI_DIR, 'state.json'), 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

export async function getMetrics(): Promise<Metrics | null> {
  try {
    const content = await fs.readFile(path.join(RALPH_CLI_DIR, 'metrics.json'), 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

export async function getActivityLogs(): Promise<{ date: string; content: string }[]> {
  try {
    const activityDir = path.join(DOCS_DIR, 'activity')
    const files = await fs.readdir(activityDir)
    const mdFiles = files.filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))

    const logs = await Promise.all(
      mdFiles.map(async (file) => {
        const content = await fs.readFile(path.join(activityDir, file), 'utf-8')
        return {
          date: file.replace('.md', ''),
          content
        }
      })
    )

    return logs.sort((a, b) => b.date.localeCompare(a.date))
  } catch {
    return []
  }
}

export async function getLearnings(): Promise<{ category: string; content: string }[]> {
  try {
    const learningsDir = path.join(DOCS_DIR, 'learnings')
    const files = await fs.readdir(learningsDir)
    const mdFiles = files.filter(f => f.endsWith('.md'))

    const learnings = await Promise.all(
      mdFiles.map(async (file) => {
        const content = await fs.readFile(path.join(learningsDir, file), 'utf-8')
        return {
          category: file.replace('.md', ''),
          content
        }
      })
    )

    return learnings
  } catch {
    return []
  }
}

// Computed data helpers
export function getPhaseProgress(prd: PRD): PhaseProgress[] {
  const phases = new Map<number, PhaseProgress>()

  for (const story of prd.stories) {
    if (!phases.has(story.phase)) {
      phases.set(story.phase, {
        phase: story.phase,
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

  for (const story of prd.stories) {
    const key = `${story.phase}-${story.epic}`
    if (!epics.has(key)) {
      epics.set(key, {
        phase: story.phase,
        epic: story.epic,
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
