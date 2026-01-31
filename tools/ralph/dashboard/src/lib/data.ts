import fs from 'fs/promises'
import path from 'path'
import type { PRD, State, Metrics, PhaseProgress, EpicProgress, Story, VersionInfo, BlockedInfo, KnowledgeChapter, ChapterIndex, KnowledgePage } from './types'

import { settings as settingsDb } from './db'
import * as prd from './db/prd'
import type { RunStatus } from './types'

// Paths relative to project root
const PROJECT_ROOT = path.join(process.cwd(), '../../..')
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs')
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs')

export type Theme = 'light' | 'dark' | 'cyber-light' | 'cyber-dark' | 'system'
export type GraphDirection = 'horizontal' | 'vertical'

export type Settings = {
  theme: Theme
  graphDirection: GraphDirection
  showDeadEnds: boolean
  showExternalDeps: boolean
  defaultVersion: string
  timezone: string
}

const defaultSettings: Settings = {
  theme: 'dark',
  graphDirection: 'horizontal',
  showDeadEnds: false,
  showExternalDeps: false,
  defaultVersion: 'first',
  timezone: 'UTC'
}

export async function getSettings(): Promise<Settings> {
  try {
    const stored = settingsDb.getAll()
    return {
      theme: (stored.theme as Theme) || defaultSettings.theme,
      graphDirection: (stored.graphDirection as GraphDirection) || defaultSettings.graphDirection,
      showDeadEnds: stored.showDeadEnds === 'true',
      showExternalDeps: stored.showExternalDeps === 'true',
      defaultVersion: stored.defaultVersion || defaultSettings.defaultVersion,
      timezone: stored.timezone || defaultSettings.timezone,
    }
  } catch {
    return defaultSettings
  }
}

// Get list of available versions from SQLite database
export async function getVersions(): Promise<string[]> {
  try {
    return prd.versions.list()
  } catch {
    return []
  }
}

// Get PRD for a specific version from SQLite
export async function getPRDForVersion(version: string): Promise<PRD | null> {
  try {
    return prd.getPRD(version)
  } catch {
    return null
  }
}

// Get all PRDs combined (for aggregate views) from SQLite
export async function getAllPRDs(): Promise<PRD | null> {
  try {
    return prd.getAllPRDs()
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

// Get version progress stats from SQLite
export async function getVersionProgress(): Promise<VersionInfo[]> {
  const versionList = prd.versions.list()
  const progress: VersionInfo[] = []

  for (const version of versionList) {
    const versionData = prd.versions.get(version)
    const storyList = prd.stories.list(version)

    const total = storyList.length
    const merged = storyList.filter(s => s.merged).length
    const passed = storyList.filter(s => s.passes && !s.merged).length
    const skipped = storyList.filter(s => s.skipped).length

    progress.push({
      version,
      title: versionData?.title,
      shortTitle: versionData?.shortTitle,
      description: versionData?.description,
      total,
      merged,
      passed,
      skipped,
      percentage: total > 0 ? Math.round((merged / total) * 100) : 0
    })
  }

  return progress
}

// Get version metadata only (for dropdowns, etc.) from SQLite
export async function getVersionsWithMetadata(): Promise<{ version: string; title?: string; shortTitle?: string; description?: string }[]> {
  const versionList = prd.versions.list()
  return versionList.map(version => {
    const data = prd.versions.get(version)
    return {
      version,
      title: data?.title,
      shortTitle: data?.shortTitle,
      description: data?.description
    }
  })
}

export async function getState(): Promise<State | null> {
  try {
    const state = prd.runState.get()
    // Get current story to fetch branch/pr_url from it
    const currentStory = state.current_story ? prd.stories.get(state.current_story) : null

    return {
      version: 1,
      current_story: state.current_story,
      status: (state.status as RunStatus) || 'idle',
      error: state.last_error,
      started_at: null,
      branch: currentStory?.working_branch || null,
      attempts: state.attempts,
      pr_url: currentStory?.pr_url || null,
      last_updated: null,
      checkpoints: []
    }
  } catch {
    return null
  }
}

export async function getMetrics(): Promise<Metrics | null> {
  try {
    const totals = prd.executionLog.getTotals()
    const allStories = prd.stories.list()
    const passedCount = allStories.filter(s => s.passes).length
    const mergedCount = allStories.filter(s => s.merged).length

    return {
      total_tokens: totals.total_input_tokens + totals.total_output_tokens,
      total_input_tokens: totals.total_input_tokens,
      total_output_tokens: totals.total_output_tokens,
      total_duration_seconds: totals.total_duration_seconds,
      stories_passed: passedCount,
      stories_prd: allStories.length,
      stories_merged: mergedCount,
      stories: [] // Per-story metrics derived from execution_log if needed
    }
  } catch {
    return null
  }
}

export type ActivityProject = 'trinity' | 'ralph'

export async function getActivityLogs(project: ActivityProject = 'trinity'): Promise<{ date: string; content: string; archived: boolean }[]> {
  try {
    const activityDir = path.join(LOGS_DIR, 'activity', project)
    const archiveDir = path.join(activityDir, 'archive')
    const logs: { date: string; content: string; archived: boolean }[] = []

    // Read recent logs from project directory
    try {
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
    } catch {
      // Directory might not exist yet
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

export async function getActivityProjects(): Promise<ActivityProject[]> {
  try {
    const activityDir = path.join(LOGS_DIR, 'activity')
    const entries = await fs.readdir(activityDir, { withFileTypes: true })
    const projects = entries
      .filter(e => e.isDirectory() && ['trinity', 'ralph'].includes(e.name))
      .map(e => e.name as ActivityProject)
      .sort((a) => a === 'trinity' ? -1 : 1) // Trinity first
    return projects.length > 0 ? projects : ['trinity']
  } catch {
    return ['trinity']
  }
}

export async function getKnowledge(): Promise<{ category: string; content: string }[]> {
  try {
    const knowledgeDir = path.join(DOCS_DIR, 'knowledge')
    const files = await fs.readdir(knowledgeDir)
    const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md')

    const knowledge = await Promise.all(
      mdFiles.map(async (file) => {
        const content = await fs.readFile(path.join(knowledgeDir, file), 'utf-8')
        return {
          category: file.replace('.md', ''),
          content
        }
      })
    )

    return knowledge
  } catch {
    return []
  }
}

export async function getGotchas(): Promise<{ category: string; content: string }[]> {
  try {
    const gotchasDir = path.join(DOCS_DIR, 'gotchas')
    const files = await fs.readdir(gotchasDir)
    const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md')

    const gotchas = await Promise.all(
      mdFiles.map(async (file) => {
        const content = await fs.readFile(path.join(gotchasDir, file), 'utf-8')
        return {
          category: file.replace('.md', ''),
          content
        }
      })
    )

    return gotchas
  } catch {
    return []
  }
}

async function getChaptersFromDir(dirPath: string): Promise<KnowledgeChapter[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    const chapters: KnowledgeChapter[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue  // Skip loose files

      const chapterDir = path.join(dirPath, entry.name)
      const indexPath = path.join(chapterDir, 'index.json')

      try {
        // Read index.json for metadata
        const indexContent = await fs.readFile(indexPath, 'utf-8')
        const index: ChapterIndex = JSON.parse(indexContent)

        // Read pages based on order in index.json
        const pages: KnowledgePage[] = []
        for (const pageMeta of index.pages) {
          const mdPath = path.join(chapterDir, `${pageMeta.slug}.md`)
          try {
            const content = await fs.readFile(mdPath, 'utf-8')
            pages.push({
              slug: pageMeta.slug,
              title: pageMeta.title,
              content
            })
          } catch {
            // Page file doesn't exist, skip
          }
        }

        chapters.push({
          slug: entry.name,
          index,
          pages
        })
      } catch {
        // No index.json or invalid, skip this directory
      }
    }

    // Sort chapters alphabetically by title
    return chapters.sort((a, b) => a.index.title.localeCompare(b.index.title))
  } catch {
    return []
  }
}

export async function getKnowledgeChapters(): Promise<KnowledgeChapter[]> {
  return getChaptersFromDir(path.join(DOCS_DIR, 'knowledge'))
}

export async function getGotchasChapters(): Promise<KnowledgeChapter[]> {
  return getChaptersFromDir(path.join(DOCS_DIR, 'gotchas'))
}

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

// Get a single story directly from SQLite (efficient - doesn't load full PRD)
export async function getStory(id: string): Promise<Story | null> {
  try {
    return prd.stories.get(id)
  } catch {
    return null
  }
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
