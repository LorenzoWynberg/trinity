import fs from 'fs/promises'
import path from 'path'
import type { PRD, State, Metrics, PhaseProgress, EpicProgress, Story, VersionInfo } from './types'

// Paths relative to project root
const PROJECT_ROOT = path.join(process.cwd(), '../../..')
const RALPH_CLI_DIR = path.join(PROJECT_ROOT, 'tools/ralph/cli')
const PRD_DIR = path.join(RALPH_CLI_DIR, 'prd')
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs')
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs')

// Get list of available versions from prd/ directory
export async function getVersions(): Promise<string[]> {
  try {
    const files = await fs.readdir(PRD_DIR)
    return files
      .filter(f => f.match(/^v[\d.]+\.json$/))
      .map(f => f.replace('.json', ''))
      .sort((a, b) => {
        // Sort versions properly (v1.0 before v2.0, etc.)
        const [, aMajor, aMinor] = a.match(/v(\d+)\.(\d+)/) || [, '0', '0']
        const [, bMajor, bMinor] = b.match(/v(\d+)\.(\d+)/) || [, '0', '0']
        if (aMajor !== bMajor) return parseInt(aMajor) - parseInt(bMajor)
        return parseInt(aMinor) - parseInt(bMinor)
      })
  } catch {
    return []
  }
}

// Get PRD for a specific version
export async function getPRDForVersion(version: string): Promise<PRD | null> {
  try {
    const content = await fs.readFile(path.join(PRD_DIR, `${version}.json`), 'utf-8')
    const prd = JSON.parse(content)
    // Tag stories with their version
    prd.stories = prd.stories.map((s: Story) => ({ ...s, target_version: version }))
    return prd
  } catch {
    return null
  }
}

// Get all PRDs combined (for aggregate views)
export async function getAllPRDs(): Promise<PRD | null> {
  try {
    const versions = await getVersions()
    if (versions.length === 0) return null

    const allStories: Story[] = []
    let projectName = ''

    for (const version of versions) {
      const prd = await getPRDForVersion(version)
      if (prd) {
        projectName = prd.project
        allStories.push(...prd.stories)
      }
    }

    return {
      project: projectName,
      version: 'all',
      stories: allStories
    }
  } catch {
    return null
  }
}

// Legacy function for backwards compatibility - returns all versions combined
export async function getPRD(version?: string): Promise<PRD | null> {
  if (version && version !== 'all') {
    return getPRDForVersion(version)
  }
  return getAllPRDs()
}

// Get version progress stats
export async function getVersionProgress(): Promise<VersionInfo[]> {
  const versions = await getVersions()
  const progress: VersionInfo[] = []

  for (const version of versions) {
    const prd = await getPRDForVersion(version)
    if (prd) {
      const total = prd.stories.length
      const merged = prd.stories.filter(s => s.merged).length
      const passed = prd.stories.filter(s => s.passes && !s.merged).length
      const skipped = prd.stories.filter(s => s.skipped).length
      progress.push({
        version,
        total,
        merged,
        passed,
        skipped,
        percentage: total > 0 ? Math.round((merged / total) * 100) : 0
      })
    }
  }

  return progress
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

export async function getActivityLogs(): Promise<{ date: string; content: string; archived: boolean }[]> {
  try {
    const activityDir = path.join(LOGS_DIR, 'activity')
    const archiveDir = path.join(activityDir, 'archive')
    const logs: { date: string; content: string; archived: boolean }[] = []

    // Read recent logs from main directory
    const files = await fs.readdir(activityDir)
    const mdFiles = files.filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))

    for (const file of mdFiles) {
      const content = await fs.readFile(path.join(activityDir, file), 'utf-8')
      logs.push({
        date: file.replace('.md', ''),
        content,
        archived: false
      })
    }

    // Read archived logs from archive/YYYY-MM/ subdirectories
    try {
      const archiveMonths = await fs.readdir(archiveDir)
      for (const month of archiveMonths) {
        if (!month.match(/^\d{4}-\d{2}$/)) continue
        const monthDir = path.join(archiveDir, month)
        const stat = await fs.stat(monthDir)
        if (!stat.isDirectory()) continue

        const archivedFiles = await fs.readdir(monthDir)
        for (const file of archivedFiles) {
          if (!file.match(/^\d{4}-\d{2}-\d{2}\.md$/)) continue
          const content = await fs.readFile(path.join(monthDir, file), 'utf-8')
          logs.push({
            date: file.replace('.md', ''),
            content,
            archived: true
          })
        }
      }
    } catch {
      // Archive directory might not exist yet
    }

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
