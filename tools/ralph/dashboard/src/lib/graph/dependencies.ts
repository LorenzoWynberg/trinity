import type { Story } from '../types'

export type ResolvedDep = {
  storyId: string
  nodeId: string
  crossVersion: boolean
}

/**
 * Resolve a dependency reference to story IDs
 * Supports: 1.2.3 (story), v1.0:1.2.3 (cross-version story), v1.0 (whole version), 1 (phase), 1:2 (phase:epic)
 * Returns: array of { storyId, nodeId } where nodeId = version:storyId
 */
export function resolveDependency(dep: string, stories: Story[], currentVersion?: string): ResolvedDep[] {
  // Full version dependency (e.g., "v1.0") - return leaf stories
  if (/^v[0-9]+\.[0-9]+$/.test(dep)) {
    const version = dep
    const versionStories = stories.filter(s => s.target_version === version)
    const versionIds = new Set(versionStories.map(s => s.id))
    const dependedOn = new Set<string>()
    versionStories.forEach(s => {
      s.depends_on?.forEach(d => {
        if (versionIds.has(d)) dependedOn.add(d)
      })
    })
    return versionStories
      .filter(s => !dependedOn.has(s.id))
      .map(s => ({ storyId: s.id, nodeId: `${version}:${s.id}`, crossVersion: version !== currentVersion }))
  }

  // Cross-version specific story (e.g., "v0.1:1.2.3")
  if (/^v[0-9]+\.[0-9]+:[0-9]+\.[0-9]+\.[0-9]+$/.test(dep)) {
    // Split carefully - version is "vX.Y", story is the rest after first ":"
    const colonIndex = dep.indexOf(':')
    const version = dep.slice(0, colonIndex)
    const storyId = dep.slice(colonIndex + 1)
    const found = stories.find(s => s.id === storyId && s.target_version === version)
    if (found) {
      return [{ storyId: found.id, nodeId: `${version}:${found.id}`, crossVersion: version !== currentVersion }]
    }
    return []
  }

  // Specific story in same version (e.g., "1.2.3")
  if (/^[0-9]+\.[0-9]+\.[0-9]+$/.test(dep)) {
    // Find in same version first, then any version
    const sameVersion = stories.find(s => s.id === dep && s.target_version === currentVersion)
    if (sameVersion) {
      return [{ storyId: sameVersion.id, nodeId: `${currentVersion}:${sameVersion.id}`, crossVersion: false }]
    }
    const anyVersion = stories.find(s => s.id === dep)
    if (anyVersion) {
      return [{ storyId: anyVersion.id, nodeId: `${anyVersion.target_version}:${anyVersion.id}`, crossVersion: anyVersion.target_version !== currentVersion }]
    }
    return []
  }

  // Version-scoped phase or epic (e.g., "v0.1:1" or "v0.1:1:2")
  if (/^v[0-9]+\.[0-9]+:[0-9]+/.test(dep)) {
    // Split carefully - version is "vX.Y", target is the rest after first ":"
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

  const matchingIds = new Set(matchingStories.map(s => s.id))
  const dependedOn = new Set<string>()
  matchingStories.forEach(s => {
    s.depends_on?.forEach(d => {
      if (matchingIds.has(d)) dependedOn.add(d)
    })
  })

  return matchingStories
    .filter(s => !dependedOn.has(s.id))
    .map(s => ({ storyId: s.id, nodeId: `${version}:${s.id}`, crossVersion: version !== currentVersion }))
}
