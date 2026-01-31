'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Node, Edge, MarkerType } from '@xyflow/react'
import { api } from '@/lib/api'
import type { Story, StoryStatus, VersionInfo } from '@/lib/types'
import {
  resolveDependency,
  calculateAutoPositions,
  defaultLayoutData,
  type GraphLayoutData,
} from '@/lib/graph'

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
        const [prd, state, versionsData, layoutRes] = await Promise.all([
          api.prd.get(version !== 'all' ? version : undefined),
          api.run.getState(),
          api.prd.getVersionsWithProgress(),
          fetch(`/api/graph-layout?version=${version}`),
        ])

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

        // Always show version headers when there are versions
        const showVersionHeaders = (versionsData.versions?.length || 0) >= 1

        // Determine positions based on active layout
        const activeLayout = currentLayoutData.active || 'horizontal'
        const isAutoLayout = ['horizontal', 'vertical', 'horizontal-compact', 'vertical-compact'].includes(activeLayout)

        let positions: Record<string, { x: number; y: number }>
        if (isAutoLayout) {
          positions = calculateAutoPositions(storiesData, activeLayout as any, showVersionHeaders)
        } else {
          // Use custom layout positions
          const customLayout = currentLayoutData.customLayouts[activeLayout]
          if (customLayout && Object.keys(customLayout.positions).length > 0) {
            // Merge with auto positions for any new stories
            const autoPositions = calculateAutoPositions(storiesData, 'horizontal', showVersionHeaders)
            positions = { ...autoPositions, ...customLayout.positions }
          } else {
            positions = calculateAutoPositions(storiesData, 'horizontal', showVersionHeaders)
          }
        }

        // Build nodes and edges
        const { nodeList, edgeList } = buildNodesAndEdges(
          storiesData,
          versionsData.progress || [],
          positions,
          currentStoryId,
          activeLayout,
          isAutoLayout,
          showVersionHeaders
        )

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

/**
 * Build React Flow nodes and edges from story data
 */
function buildNodesAndEdges(
  storiesData: Story[],
  versionProgress: VersionInfo[],
  positions: Record<string, { x: number; y: number }>,
  currentStoryId: string | null,
  activeLayout: string,
  isAutoLayout: boolean,
  showVersionHeaders: boolean
): { nodeList: Node[]; edgeList: Edge[] } {
  const nodeList: Node[] = []
  const edgeList: Edge[] = []

  const getNodeId = (story: Story) => `${story.target_version}:${story.id}`

  // Find dead-end nodes (stories that nothing in the SAME VERSION depends on)
  const dependedOn = new Set<string>()
  storiesData.forEach(story => {
    if (story.depends_on) {
      story.depends_on.forEach(depRef => {
        const resolved = resolveDependency(depRef, storiesData, story.target_version)
        resolved.forEach(r => {
          if (!r.crossVersion) {
            dependedOn.add(r.nodeId)
          }
        })
      })
    }
  })

  // Add version header nodes
  if (showVersionHeaders) {
    for (const progress of versionProgress) {
      const pos = positions[`version:${progress.version}`] || { x: 0, y: 0 }
      nodeList.push({
        id: `version:${progress.version}`,
        type: 'version',
        position: pos,
        draggable: !isAutoLayout,
        data: {
          label: progress.version,
          title: progress.title,
          shortTitle: progress.shortTitle,
          description: progress.description,
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
    const nodeId = getNodeId(story)
    const status = getStoryStatus(story, currentStoryId)
    const pos = positions[nodeId] || { x: 0, y: 0 }
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

  // Add edges
  const nodeIdSet = new Set(storiesData.map(s => getNodeId(s)))
  const edgeIds = new Set<string>()

  // Edges from leaf stories to version nodes
  if (showVersionHeaders) {
    for (const story of storiesData) {
      const nodeId = getNodeId(story)
      const isLeaf = !dependedOn.has(nodeId)

      if (isLeaf && story.target_version) {
        edgeList.push({
          id: `${nodeId}->version:${story.target_version}`,
          source: nodeId,
          target: `version:${story.target_version}`,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
          style: { strokeWidth: 2, stroke: '#6b7280' },
        })
      }
    }
  }

  // Dependency edges
  const crossVersionEdgesCreated = new Set<string>()

  for (const story of storiesData) {
    const storyNodeId = getNodeId(story)
    if (!story.depends_on) continue

    for (const depRef of story.depends_on) {
      // Full version dependency (e.g., "v1.0")
      if (/^v[0-9]+\.[0-9]+$/.test(depRef) && showVersionHeaders && story.target_version) {
        const crossEdgeId = `version:${depRef}->${storyNodeId}`
        if (!crossVersionEdgesCreated.has(crossEdgeId)) {
          crossVersionEdgesCreated.add(crossEdgeId)
          edgeList.push({
            id: crossEdgeId,
            source: `version:${depRef}`,
            target: storyNodeId,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
            style: { strokeWidth: 3, stroke: '#f59e0b', strokeDasharray: '5,5' },
            data: { crossVersion: true },
          })
        }
        continue
      }

      // Story-to-story dependencies
      const resolved = resolveDependency(depRef, storiesData, story.target_version)

      for (const { nodeId: depNodeId, storyId: depStoryId, crossVersion } of resolved) {
        if (!nodeIdSet.has(depNodeId)) continue

        const edgeId = `${depNodeId}->${storyNodeId}`
        if (edgeIds.has(edgeId)) continue
        edgeIds.add(edgeId)

        const depStory = storiesData.find(s => s.id === depStoryId)
        const isDepMerged = depStory?.merged
        const isCrossVersionStoryEdge = crossVersion && showVersionHeaders

        edgeList.push({
          id: edgeId,
          source: depNodeId,
          target: storyNodeId,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
          style: {
            strokeWidth: isCrossVersionStoryEdge ? 3 : 2,
            stroke: isCrossVersionStoryEdge ? '#f59e0b' : (isDepMerged ? '#22c55e' : '#6b7280'),
            strokeDasharray: isCrossVersionStoryEdge ? '5,5' : undefined,
          },
          data: { crossVersion: isCrossVersionStoryEdge },
          animated: getStoryStatus(story, currentStoryId) === 'in_progress',
        })
      }
    }
  }

  return { nodeList, edgeList }
}

// Re-export for backwards compatibility
export { resolveDependency, calculateAutoPositions } from '@/lib/graph'
export type { GraphLayoutData } from '@/lib/graph'
