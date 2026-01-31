import * as prdDb from '../db/prd'
import type { PRD, Story, VersionInfo } from '../types'

// Get list of available versions from SQLite database
export async function getVersions(): Promise<string[]> {
  try {
    return prdDb.versions.list()
  } catch {
    return []
  }
}

// Get PRD for a specific version from SQLite
export async function getPRDForVersion(version: string): Promise<PRD | null> {
  try {
    return prdDb.getPRD(version)
  } catch {
    return null
  }
}

// Get all PRDs combined (for aggregate views) from SQLite
export async function getAllPRDs(): Promise<PRD | null> {
  try {
    return prdDb.getAllPRDs()
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
  const versionList = prdDb.versions.list()
  const progress: VersionInfo[] = []

  for (const version of versionList) {
    const versionData = prdDb.versions.get(version)
    const storyList = prdDb.stories.list(version)

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
  const versionList = prdDb.versions.list()
  return versionList.map(version => {
    const data = prdDb.versions.get(version)
    return {
      version,
      title: data?.title,
      shortTitle: data?.shortTitle,
      description: data?.description
    }
  })
}

// Get a single story directly from SQLite (efficient - doesn't load full PRD)
export async function getStory(id: string): Promise<Story | null> {
  try {
    return prdDb.stories.get(id)
  } catch {
    return null
  }
}
