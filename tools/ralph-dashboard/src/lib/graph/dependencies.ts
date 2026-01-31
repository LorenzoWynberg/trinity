import type { Story } from '../types'

export type ResolvedDep = {
  storyId: string
  nodeId: string
  crossVersion: boolean
}

/**
 * Extract the story number from a full ID (e.g., "v0.1:1.1.1" -> "1.1.1")
 */
function extractStoryNumber(fullId: string): string {
  const colonIndex = fullId.indexOf(':')
  return colonIndex >= 0 ? fullId.slice(colonIndex + 1) : fullId
}

/**
 * Resolve a dependency reference to story IDs
 * Supports: 1.2.3 (story), v1.0:1.2.3 (cross-version story), v1.0 (whole version), 1 (phase), 1:2 (phase:epic)
 *
 * Note: Story IDs in the database are prefixed with version (e.g., "v0.1:1.1.1")
 * But depends_on arrays contain unprefixed refs (e.g., "1.1.1") for same-version deps
 *
 * Returns: array of { storyId, nodeId } where nodeId = story.id (already includes version)
 */
export function resolveDependency(dep: string, stories: Story[], currentVersion?: string): ResolvedDep[] {
  // Full version dependency (e.g., "v1.0") - return leaf stories
  if (/^v[0-9]+\.[0-9]+$/.test(dep)) {
    const version = dep
    const versionStories = stories.filter(s => s.target_version === version)
    const storyNumbers = new Set(versionStories.map(s => extractStoryNumber(s.id)))
    const dependedOn = new Set<string>()
    versionStories.forEach(s => {
      s.depends_on?.forEach(d => {
        // depends_on contains story numbers, not full IDs
        if (storyNumbers.has(d)) dependedOn.add(d)
      })
    })
    return versionStories
      .filter(s => !dependedOn.has(extractStoryNumber(s.id)))
      .map(s => ({ storyId: s.id, nodeId: s.id, crossVersion: version !== currentVersion }))
  }

  // Cross-version specific story (e.g., "v0.1:1.2.3")
  if (/^v[0-9]+\.[0-9]+:[0-9]+\.[0-9]+\.[0-9]+$/.test(dep)) {
    const colonIndex = dep.indexOf(':')
    const version = dep.slice(0, colonIndex)
    const storyNumber = dep.slice(colonIndex + 1)
    // The full ID in the database is the dep itself (e.g., "v0.1:1.2.3")
    const found = stories.find(s => s.id === dep)
    if (found) {
      return [{ storyId: found.id, nodeId: found.id, crossVersion: version !== currentVersion }]
    }
    return []
  }

  // Specific story in same version (e.g., "1.2.3")
  if (/^[0-9]+\.[0-9]+\.[0-9]+$/.test(dep)) {
    // Construct the full ID with version prefix
    if (currentVersion) {
      const fullId = `${currentVersion}:${dep}`
      const found = stories.find(s => s.id === fullId)
      if (found) {
        return [{ storyId: found.id, nodeId: found.id, crossVersion: false }]
      }
    }
    // Fallback: search any version
    const anyVersion = stories.find(s => extractStoryNumber(s.id) === dep)
    if (anyVersion) {
      return [{ storyId: anyVersion.id, nodeId: anyVersion.id, crossVersion: anyVersion.target_version !== currentVersion }]
    }
    return []
  }

  // Version-scoped phase or epic (e.g., "v0.1:1" or "v0.1:1:2")
  if (/^v[0-9]+\.[0-9]+:[0-9]+/.test(dep)) {
    const colonIndex = dep.indexOf(':')
    const version = dep.slice(0, colonIndex)
    const target = dep.slice(colonIndex + 1)
    const filteredStories = stories.filter(s => s.target_version === version)
    return resolvePhaseEpic(target, filteredStories, version, currentVersion)
  }

  // Phase:Epic (e.g., "1:2") - scope to current version
  if (/^[0-9]+:[0-9]+$/.test(dep)) {
    const filteredStories = currentVersion
      ? stories.filter(s => s.target_version === currentVersion)
      : stories
    return resolvePhaseEpic(dep, filteredStories, currentVersion || 'unknown', currentVersion)
  }

  // Just phase (e.g., "1") - scope to current version
  if (/^[0-9]+$/.test(dep)) {
    const filteredStories = currentVersion
      ? stories.filter(s => s.target_version === currentVersion)
      : stories
    return resolvePhaseEpic(dep, filteredStories, currentVersion || 'unknown', currentVersion)
  }

  return []
}

/**
 * Helper to resolve phase or phase:epic to leaf stories
 */
function resolvePhaseEpic(target: string, filteredStories: Story[], version: string, currentVersion?: string): ResolvedDep[] {
  let matchingStories: Story[]

  if (/^[0-9]+:[0-9]+$/.test(target)) {
    const [phase, epic] = target.split(':').map(Number)
    matchingStories = filteredStories.filter(s => s.phase === phase && s.epic === epic)
  } else {
    const phase = Number(target)
    matchingStories = filteredStories.filter(s => s.phase === phase)
  }

  const storyNumbers = new Set(matchingStories.map(s => extractStoryNumber(s.id)))
  const dependedOn = new Set<string>()
  matchingStories.forEach(s => {
    s.depends_on?.forEach(d => {
      if (storyNumbers.has(d)) dependedOn.add(d)
    })
  })

  return matchingStories
    .filter(s => !dependedOn.has(extractStoryNumber(s.id)))
    .map(s => ({ storyId: s.id, nodeId: s.id, crossVersion: version !== currentVersion }))
}
