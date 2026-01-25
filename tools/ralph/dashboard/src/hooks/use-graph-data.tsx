'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Node, Edge, MarkerType } from '@xyflow/react'
import type { Story, StoryStatus, VersionInfo } from '@/lib/types'

export type GraphLayoutData = {
  active: string // 'horizontal' | 'vertical' | custom layout name
  defaultLayout: string // default layout to use when loading this version
  customLayouts: Record<string, { positions: Record<string, { x: number; y: number }> }>
}

type GraphData = {
  nodes: Node[]
  edges: Edge[]
  stories: Story[]
  loading: boolean
  versions: string[]
  versionProgress: VersionInfo[]
  layoutData: GraphLayoutData
  saveLayoutData: (data: GraphLayoutData) => Promise<void>
  deleteCustomLayout: (name: string) => Promise<void>
}

function getStoryStatus(story: Story, currentStoryId: string | null): StoryStatus {
  if (story.skipped) return 'skipped'
  if (story.merged) return 'merged'
  if (story.passes) return 'passed'
  if (story.id === currentStoryId) return 'in_progress'
  return 'pending'
}

// Resolve a dependency reference to story IDs
// Supports: 1.2.3 (story), v1.0:1.2.3 (cross-version story), v1.0 (whole version), 1 (phase), 1:2 (phase:epic)
// Returns: array of { storyId, nodeId } where nodeId = version:storyId
export function resolveDependency(dep: string, stories: Story[], currentVersion?: string): { storyId: string; nodeId: string; crossVersion: boolean }[] {
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

  // Cross-version specific story (e.g., "v1.0:1.2.3")
  if (/^v[0-9]+\.[0-9]+:[0-9]+\.[0-9]+\.[0-9]+$/.test(dep)) {
    const [version, storyId] = dep.split(':')
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

  // Version-scoped phase or epic (e.g., "v1.0:1" or "v1.0:1:2")
  if (/^v[0-9]+\.[0-9]+:[0-9]+/.test(dep)) {
    const parts = dep.split(':')
    const version = parts[0]
    const target = parts.slice(1).join(':')
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

// Helper to resolve phase or phase:epic to leaf stories
function resolvePhaseEpic(target: string, filteredStories: Story[], version: string, currentVersion?: string): { storyId: string; nodeId: string; crossVersion: boolean }[] {
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

// Calculate depth of each node (longest path from root)
function calculateDepths(stories: Story[]): Map<string, number> {
  const depths = new Map<string, number>()
  const storyMap = new Map(stories.map(s => [s.id, s]))

  function getDepth(id: string, visited: Set<string> = new Set()): number {
    if (visited.has(id)) return 0 // Cycle protection
    if (depths.has(id)) return depths.get(id)!

    visited.add(id)
    const story = storyMap.get(id)
    if (!story || !story.depends_on || story.depends_on.length === 0) {
      depths.set(id, 0)
      return 0
    }

    // Resolve all dependencies (including phase/epic refs) to story IDs
    const resolvedDeps = story.depends_on.flatMap(dep =>
      resolveDependency(dep, stories, story.target_version).map(r => r.storyId)
    )
    const validDeps = resolvedDeps.filter(dep => storyMap.has(dep))

    if (validDeps.length === 0) {
      depths.set(id, 0)
      return 0
    }

    const maxDepDep = Math.max(...validDeps.map(dep => getDepth(dep, visited)))
    const depth = maxDepDep + 1
    depths.set(id, depth)
    return depth
  }

  stories.forEach(s => getDepth(s.id))
  return depths
}

type LayoutDirection = 'horizontal' | 'horizontal-compact' | 'vertical' | 'vertical-compact'

// Calculate auto-layout positions for a single version
function calculateSingleVersionPositions(
  stories: Story[],
  direction: LayoutDirection,
  offsetX: number = 0,
  offsetY: number = 0
): Record<string, { x: number; y: number }> {
  const depths = calculateDepths(stories)
  const positions: Record<string, { x: number; y: number }> = {}

  // Group stories by depth
  const byDepth = new Map<number, Story[]>()
  stories.forEach(story => {
    const depth = depths.get(story.id) || 0
    if (!byDepth.has(depth)) byDepth.set(depth, [])
    byDepth.get(depth)!.push(story)
  })

  // Sort each depth group
  byDepth.forEach(group => {
    group.sort((a, b) => {
      if (a.phase !== b.phase) return a.phase - b.phase
      if (a.epic !== b.epic) return a.epic - b.epic
      return a.story_number - b.story_number
    })
  })

  const NODE_WIDTH = 170
  const NODE_HEIGHT = 70
  const MAX_PER_COL = 6

  // Spacing varies by layout type
  const isCompact = direction === 'horizontal-compact' || direction === 'vertical-compact'
  const isVertical = direction === 'vertical' || direction === 'vertical-compact'
  const H_GAP = isVertical ? 80 : 60
  const V_GAP = direction === 'horizontal-compact' ? 40 : (isVertical ? 70 : 20)

  const maxDepth = Math.max(...Array.from(depths.values()), 0)

  if (direction === 'horizontal') {
    // Horizontal: all nodes in column, unlimited height
    for (let depth = 0; depth <= maxDepth; depth++) {
      const group = byDepth.get(depth) || []
      group.forEach((story, idx) => {
        positions[story.id] = {
          x: offsetX + depth * (NODE_WIDTH + H_GAP),
          y: offsetY + idx * (NODE_HEIGHT + V_GAP)
        }
      })
    }
  } else if (direction === 'horizontal-compact') {
    // Horizontal compact: max 6 nodes per column, overflow creates new columns
    let currentCol = 0
    const maxColHeight = MAX_PER_COL * NODE_HEIGHT + (MAX_PER_COL - 1) * V_GAP

    for (let depth = 0; depth <= maxDepth; depth++) {
      const group = byDepth.get(depth) || []
      const numChunks = Math.ceil(group.length / MAX_PER_COL)

      for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
        const chunkStart = chunkIdx * MAX_PER_COL
        const chunk = group.slice(chunkStart, chunkStart + MAX_PER_COL)
        const chunkSize = chunk.length
        // Center vertically within the max column height
        const colHeight = chunkSize * NODE_HEIGHT + (chunkSize - 1) * V_GAP
        const yOff = (maxColHeight - colHeight) / 2

        chunk.forEach((story, idx) => {
          positions[story.id] = {
            x: offsetX + currentCol * (NODE_WIDTH + H_GAP),
            y: offsetY + yOff + idx * (NODE_HEIGHT + V_GAP)
          }
        })
        currentCol++
      }
    }
  } else if (direction === 'vertical') {
    // Vertical: all nodes in row, unlimited width, flows top to bottom
    for (let depth = 0; depth <= maxDepth; depth++) {
      const group = byDepth.get(depth) || []
      group.forEach((story, idx) => {
        positions[story.id] = {
          x: offsetX + idx * (NODE_WIDTH + H_GAP),
          y: offsetY + depth * (NODE_HEIGHT + V_GAP)
        }
      })
    }
  } else {
    // Vertical compact: max 6 nodes per row, flows top to bottom
    const maxRowWidth = MAX_PER_COL * NODE_WIDTH + (MAX_PER_COL - 1) * H_GAP
    let currentRow = 0

    for (let depth = 0; depth <= maxDepth; depth++) {
      const group = byDepth.get(depth) || []

      for (let chunkStart = 0; chunkStart < group.length; chunkStart += MAX_PER_COL) {
        const chunk = group.slice(chunkStart, chunkStart + MAX_PER_COL)
        const chunkSize = chunk.length
        const rowWidth = chunkSize * NODE_WIDTH + (chunkSize - 1) * H_GAP
        const xOff = (maxRowWidth - rowWidth) / 2

        chunk.forEach((story, idx) => {
          positions[story.id] = {
            x: offsetX + xOff + idx * (NODE_WIDTH + H_GAP),
            y: offsetY + currentRow * (NODE_HEIGHT + V_GAP)
          }
        })
        currentRow++
      }
    }
  }

  return positions
}

// Calculate auto-layout positions with version grouping
export function calculateAutoPositions(
  stories: Story[],
  direction: LayoutDirection,
  includeVersionHeaders: boolean = false
): Record<string, { x: number; y: number }> {
  // Group stories by version
  const byVersion = new Map<string, Story[]>()
  stories.forEach(story => {
    const ver = story.target_version || 'unknown'
    if (!byVersion.has(ver)) byVersion.set(ver, [])
    byVersion.get(ver)!.push(story)
  })

  // Sort versions
  const sortedVersions = Array.from(byVersion.keys()).sort((a, b) => {
    const [, aMajor, aMinor] = a.match(/v(\d+)\.(\d+)/) || [, '0', '0']
    const [, bMajor, bMinor] = b.match(/v(\d+)\.(\d+)/) || [, '0', '0']
    if (aMajor !== bMajor) return parseInt(aMajor) - parseInt(bMajor)
    return parseInt(aMinor) - parseInt(bMinor)
  })

  // If only one version and not showing headers, use simple layout
  if (sortedVersions.length <= 1 && !includeVersionHeaders) {
    return calculateSingleVersionPositions(stories, direction)
  }

  const positions: Record<string, { x: number; y: number }> = {}
  const NODE_WIDTH = 170
  const NODE_HEIGHT = 70
  const VERSION_HEADER_WIDTH = 180
  const VERSION_HEADER_HEIGHT = 70
  const VERSION_GAP = 100
  const isVertical = direction === 'vertical' || direction === 'vertical-compact'
  const H_GAP = isVertical ? 80 : 60
  const V_GAP = direction === 'horizontal-compact' ? 40 : (isVertical ? 70 : 20)

  if (direction === 'horizontal' || direction === 'horizontal-compact') {
    let currentX = 0
    const MAX_PER_COL = 6

    for (const ver of sortedVersions) {
      const verStories = byVersion.get(ver) || []
      if (verStories.length === 0) continue

      // Start position for stories (leave room for version header on left)
      const storiesStartX = includeVersionHeaders ? currentX + VERSION_HEADER_WIDTH + H_GAP : currentX

      const verPositions = calculateSingleVersionPositions(verStories, direction, storiesStartX, 0)
      Object.assign(positions, verPositions)

      if (includeVersionHeaders) {
        if (direction === 'horizontal-compact') {
          // For compact, center version header in max column height
          const maxColHeight = MAX_PER_COL * NODE_HEIGHT + (MAX_PER_COL - 1) * V_GAP
          const centerY = (maxColHeight - VERSION_HEADER_HEIGHT) / 2
          positions[`version:${ver}`] = { x: currentX, y: centerY }
        } else {
          // For regular horizontal, find root stories and center with them
          const depths = calculateDepths(verStories)
          const rootStories = verStories.filter(s => (depths.get(s.id) || 0) === 0)

          if (rootStories.length > 0) {
            const rootYs = rootStories.map(s => verPositions[s.id]?.y || 0)
            const minY = Math.min(...rootYs)
            const maxY = Math.max(...rootYs)
            const centerY = (minY + maxY + NODE_HEIGHT - VERSION_HEADER_HEIGHT) / 2
            positions[`version:${ver}`] = { x: currentX, y: centerY }
          } else {
            positions[`version:${ver}`] = { x: currentX, y: 0 }
          }
        }
      }

      const posValues = Object.values(verPositions)
      const maxX = posValues.length > 0 ? Math.max(...posValues.map(p => p.x)) : currentX
      currentX = maxX + NODE_WIDTH + VERSION_GAP
    }
  } else {
    let currentY = 0

    for (const ver of sortedVersions) {
      const verStories = byVersion.get(ver) || []
      if (verStories.length === 0) continue

      // Calculate positions first to find centering info
      const tempPositions = calculateSingleVersionPositions(verStories, direction, 0, 0)
      const tempPosValues = Object.values(tempPositions)

      // Find root stories (no dependencies within this version)
      const storyIds = new Set(verStories.map(s => s.id))
      const rootStories = verStories.filter(s => {
        if (!s.depends_on || s.depends_on.length === 0) return true
        // Check if any deps are within this version
        return !s.depends_on.some(depId => {
          const actualId = depId.includes(':') ? depId.split(':').pop()! : depId
          return storyIds.has(actualId)
        })
      })

      // Center version header above root stories, or all stories as fallback
      let centerX = 0
      const storiesToCenter = rootStories.length > 0 ? rootStories : verStories
      if (storiesToCenter.length > 0) {
        const xs = storiesToCenter.map(s => {
          const pos = tempPositions[s.id]
          return pos ? pos.x : 0
        }).filter(x => x !== undefined)
        if (xs.length > 0) {
          const minX = Math.min(...xs)
          const maxX = Math.max(...xs)
          centerX = (minX + maxX + NODE_WIDTH - VERSION_HEADER_WIDTH) / 2
        }
      }

      if (includeVersionHeaders) {
        positions[`version:${ver}`] = { x: centerX, y: currentY }
        currentY += VERSION_HEADER_HEIGHT + V_GAP
      }

      const verPositions = calculateSingleVersionPositions(verStories, direction, 0, currentY)
      Object.assign(positions, verPositions)

      const posValues = Object.values(verPositions)
      const maxY = posValues.length > 0 ? Math.max(...posValues.map(p => p.y)) : currentY
      currentY = maxY + NODE_HEIGHT + VERSION_GAP
    }
  }

  return positions
}

const defaultLayoutData: GraphLayoutData = {
  active: 'horizontal',
  defaultLayout: 'horizontal',
  customLayouts: {}
}

export function useGraphData(version: string = 'all'): GraphData {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [versions, setVersions] = useState<string[]>([])
  const [versionProgress, setVersionProgress] = useState<VersionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [layoutData, setLayoutData] = useState<GraphLayoutData>(defaultLayoutData)
  const isInitialLoadRef = useRef(true)
  const prevVersionRef = useRef(version)
  const currentLayoutRef = useRef<GraphLayoutData>(defaultLayoutData)

  // Keep ref in sync with state
  useEffect(() => {
    currentLayoutRef.current = layoutData
  }, [layoutData])

  // Reset initial load flag when version changes
  useEffect(() => {
    if (prevVersionRef.current !== version) {
      isInitialLoadRef.current = true
      prevVersionRef.current = version
    }
  }, [version])

  // Save layout data to API
  const saveLayoutData = useCallback(async (data: GraphLayoutData) => {
    setLayoutData(data)
    try {
      await fetch(`/api/graph-layout?version=${version}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } catch (error) {
      console.error('Failed to save layout:', error)
    }
  }, [version])

  // Delete a custom layout
  const deleteCustomLayout = useCallback(async (name: string) => {
    const wasActive = currentLayoutRef.current.active === name
    try {
      await fetch(`/api/graph-layout?version=${version}&layout=${encodeURIComponent(name)}`, {
        method: 'DELETE',
      })
      // Refresh layout data
      const res = await fetch(`/api/graph-layout?version=${version}`)
      const data = await res.json()

      // If we deleted the active layout, explicitly fall back to default/horizontal
      if (wasActive) {
        data.active = data.defaultLayout || 'horizontal'
      }

      // Update both state and ref to ensure consistency
      setLayoutData(data)
      currentLayoutRef.current = data
    } catch (error) {
      console.error('Failed to delete layout:', error)
    }
  }, [version])

  useEffect(() => {
    async function fetchData() {
      try {
        const versionParam = version !== 'all' ? `?version=${version}` : ''
        const [prdRes, stateRes, versionsRes, layoutRes] = await Promise.all([
          fetch(`/api/prd${versionParam}`),
          fetch('/api/state'),
          fetch('/api/versions'),
          fetch(`/api/graph-layout?version=${version}`),
        ])

        const prd = await prdRes.json()
        const state = await stateRes.json()
        const versionsData = await versionsRes.json()
        const savedLayoutData: GraphLayoutData = await layoutRes.json()
        const currentStoryId = state?.current_story || null

        setVersions(versionsData.versions || [])
        setVersionProgress(versionsData.progress || [])

        // Determine which layout to use
        let currentLayoutData: GraphLayoutData
        if (isInitialLoadRef.current) {
          // On initial load, use defaultLayout
          currentLayoutData = {
            ...savedLayoutData,
            active: savedLayoutData.defaultLayout || savedLayoutData.active || 'horizontal',
          }
          setLayoutData(currentLayoutData)
          currentLayoutRef.current = currentLayoutData
          isInitialLoadRef.current = false
        } else {
          // On refresh, use current layout from ref (always up-to-date)
          currentLayoutData = {
            ...currentLayoutRef.current,
            customLayouts: savedLayoutData.customLayouts, // Get any updates to custom layouts
          }
        }

        if (!prd?.stories) {
          setLoading(false)
          return
        }

        const storiesData: Story[] = prd.stories
        setStories(storiesData)

        const isAllVersions = version === 'all'
        const showVersionHeaders = isAllVersions && (versionsData.versions?.length || 0) >= 1

        // Determine positions based on active layout
        let positions: Record<string, { x: number; y: number }>
        const activeLayout = currentLayoutData.active || 'horizontal'

        if (activeLayout === 'horizontal' || activeLayout === 'vertical' || activeLayout === 'horizontal-compact' || activeLayout === 'vertical-compact') {
          // Auto-calculate positions
          positions = calculateAutoPositions(storiesData, activeLayout, showVersionHeaders)
        } else {
          // Use custom layout positions
          const customLayout = currentLayoutData.customLayouts[activeLayout]
          if (customLayout && Object.keys(customLayout.positions).length > 0) {
            // Merge with auto positions for any new stories
            const autoPositions = calculateAutoPositions(storiesData, 'horizontal', showVersionHeaders)
            positions = { ...autoPositions, ...customLayout.positions }
          } else {
            // Fallback to horizontal
            positions = calculateAutoPositions(storiesData, 'horizontal', showVersionHeaders)
          }
        }

        // Create nodes
        const nodeList: Node[] = []
        const isAutoLayout = activeLayout === 'horizontal' || activeLayout === 'vertical' || activeLayout === 'horizontal-compact' || activeLayout === 'vertical-compact'

        // Add version header nodes if showing all versions
        if (showVersionHeaders) {
          for (const progress of (versionsData.progress || [])) {
            const pos = positions[`version:${progress.version}`] || { x: 0, y: 0 }
            nodeList.push({
              id: `version:${progress.version}`,
              type: 'version',
              position: pos,
              draggable: !isAutoLayout,
              data: {
                label: progress.version,
                total: progress.total,
                merged: progress.merged,
                percentage: progress.percentage,
                direction: activeLayout,
              },
            })
          }
        }

        // Build node ID helper (version:storyId)
        const getNodeId = (story: Story) => `${story.target_version}:${story.id}`

        // Find dead-end nodes (stories that nothing depends on)
        const dependedOn = new Set<string>()
        storiesData.forEach(story => {
          if (story.depends_on) {
            story.depends_on.forEach(depRef => {
              const resolved = resolveDependency(depRef, storiesData, story.target_version)
              resolved.forEach(r => dependedOn.add(r.nodeId))
            })
          }
        })

        // Add story nodes with versioned IDs
        for (const story of storiesData) {
          const nodeId = getNodeId(story)
          const status = getStoryStatus(story, currentStoryId)
          const pos = positions[story.id] || { x: 0, y: 0 }
          const isDeadEnd = !dependedOn.has(nodeId)
          nodeList.push({
            id: nodeId,
            type: 'story',
            position: pos,
            draggable: !isAutoLayout,
            data: {
              label: story.id,
              title: story.title,
              status,
              phase: story.phase,
              epic: story.epic,
              direction: activeLayout,
              isDeadEnd,
            },
          })
        }

        // Create edges
        const edgeList: Edge[] = []
        const nodeIdSet = new Set(storiesData.map(s => getNodeId(s)))
        const edgeIds = new Set<string>() // Track edge IDs to avoid duplicates

        // Add edges from version headers to root stories (no deps within SAME version)
        if (showVersionHeaders) {
          for (const story of storiesData) {
            const nodeId = getNodeId(story)
            // A story is a "root" of its version if it has no same-version deps
            const hasSameVersionDeps = story.depends_on && story.depends_on.length > 0 &&
              story.depends_on.some(depRef => {
                const resolved = resolveDependency(depRef, storiesData, story.target_version)
                return resolved.some(r => !r.crossVersion)
              })

            if (!hasSameVersionDeps && story.target_version) {
              edgeList.push({
                id: `version:${story.target_version}->${nodeId}`,
                source: `version:${story.target_version}`,
                target: nodeId,
                type: 'smoothstep',
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 12,
                  height: 12,
                },
                style: {
                  strokeWidth: 2,
                  stroke: '#6b7280',
                },
              })
            }
          }
        }

        // Track version-to-version edges we've already created
        const versionEdgesCreated = new Set<string>()

        for (const story of storiesData) {
          const storyNodeId = getNodeId(story)
          if (story.depends_on) {
            for (const depRef of story.depends_on) {
              // Check if this is a full version dependency (e.g., "v1.0")
              if (/^v[0-9]+\.[0-9]+$/.test(depRef) && showVersionHeaders && story.target_version) {
                // Create a single version-to-version edge
                const versionEdgeId = `version:${depRef}->version:${story.target_version}`
                if (!versionEdgesCreated.has(versionEdgeId)) {
                  versionEdgesCreated.add(versionEdgeId)
                  edgeList.push({
                    id: versionEdgeId,
                    source: `version:${depRef}`,
                    target: `version:${story.target_version}`,
                    type: 'smoothstep',
                    markerEnd: {
                      type: MarkerType.ArrowClosed,
                      width: 12,
                      height: 12,
                    },
                    style: {
                      strokeWidth: 3,
                      stroke: '#f59e0b',
                      strokeDasharray: '5,5',
                    },
                  })
                }
                continue // Don't create individual story edges for version deps
              }

              // Resolve dependency reference to actual story IDs
              const resolved = resolveDependency(depRef, storiesData, story.target_version)

              for (const { nodeId: depNodeId, storyId: depStoryId, crossVersion } of resolved) {
                if (nodeIdSet.has(depNodeId)) {
                  const depStory = storiesData.find(s => s.id === depStoryId)
                  const isDepMerged = depStory?.merged

                  const edgeId = `${depNodeId}->${storyNodeId}`
                  if (edgeIds.has(edgeId)) continue
                  edgeIds.add(edgeId)

                  // Cross-version story-to-story edges are orange dotted (option B)
                  const isCrossVersionStoryEdge = crossVersion && showVersionHeaders

                  edgeList.push({
                    id: edgeId,
                    source: depNodeId,
                    target: storyNodeId,
                    type: 'smoothstep',
                    markerEnd: {
                      type: MarkerType.ArrowClosed,
                      width: 12,
                      height: 12,
                    },
                    style: {
                      strokeWidth: isCrossVersionStoryEdge ? 3 : 2,
                      stroke: isCrossVersionStoryEdge ? '#f59e0b' : (isDepMerged ? '#22c55e' : '#6b7280'),
                      strokeDasharray: isCrossVersionStoryEdge ? '5,5' : undefined,
                    },
                    animated: getStoryStatus(story, currentStoryId) === 'in_progress',
                  })
                }
              }
            }
          }
        }

        setNodes(nodeList)
        setEdges(edgeList)
        setLoading(false)
      } catch (error) {
        console.error('Failed to fetch graph data:', error)
        setLoading(false)
      }
    }

    fetchData()

    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [version])

  return { nodes, edges, stories, loading, versions, versionProgress, layoutData, saveLayoutData, deleteCustomLayout }
}
