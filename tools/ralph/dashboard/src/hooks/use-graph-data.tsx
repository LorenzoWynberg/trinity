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

    const maxDepDep = Math.max(
      ...story.depends_on
        .filter(dep => storyMap.has(dep))
        .map(dep => getDepth(dep, visited))
    )
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

        // Add story nodes
        for (const story of storiesData) {
          const status = getStoryStatus(story, currentStoryId)
          const pos = positions[story.id] || { x: 0, y: 0 }
          nodeList.push({
            id: story.id,
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
            },
          })
        }

        // Create edges
        const edgeList: Edge[] = []
        const nodeIds = new Set(storiesData.map(s => s.id))

        // Add edges from version headers to root stories (stories with no deps)
        if (showVersionHeaders) {
          for (const story of storiesData) {
            const hasDeps = story.depends_on && story.depends_on.length > 0 &&
              story.depends_on.some(depId => {
                const actualDepId = depId.includes(':') ? depId.split(':').pop()! : depId
                return nodeIds.has(actualDepId)
              })

            if (!hasDeps && story.target_version) {
              edgeList.push({
                id: `version:${story.target_version}->${story.id}`,
                source: `version:${story.target_version}`,
                target: story.id,
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

        for (const story of storiesData) {
          if (story.depends_on) {
            for (const depId of story.depends_on) {
              const actualDepId = depId.includes(':') ? depId.split(':').pop()! : depId

              if (nodeIds.has(actualDepId)) {
                const depStory = storiesData.find(s => s.id === actualDepId)
                const isDepMerged = depStory?.merged
                const isCrossVersion = depStory?.target_version !== story.target_version

                edgeList.push({
                  id: `${actualDepId}->${story.id}`,
                  source: actualDepId,
                  target: story.id,
                  type: 'smoothstep',
                  markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 12,
                    height: 12,
                  },
                  style: {
                    strokeWidth: isCrossVersion ? 3 : 2,
                    stroke: isDepMerged ? '#22c55e' : (isCrossVersion ? '#f59e0b' : '#6b7280'),
                    strokeDasharray: isCrossVersion ? '5,5' : undefined,
                  },
                  animated: getStoryStatus(story, currentStoryId) === 'in_progress',
                })
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
