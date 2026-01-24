'use client'

import { useState, useEffect } from 'react'
import { Node, Edge, MarkerType } from '@xyflow/react'
import type { Story, StoryStatus } from '@/lib/types'

type GraphData = {
  nodes: Node[]
  edges: Edge[]
  stories: Story[]
  loading: boolean
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

export function useGraphData(direction: 'horizontal' | 'vertical' = 'horizontal'): GraphData {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [prdRes, stateRes] = await Promise.all([
          fetch('/api/prd'),
          fetch('/api/state'),
        ])

        const prd = await prdRes.json()
        const state = await stateRes.json()
        const currentStoryId = state?.current_story || null

        if (!prd?.stories) {
          setLoading(false)
          return
        }

        const storiesData: Story[] = prd.stories
        const depths = calculateDepths(storiesData)

        // Group stories by depth
        const byDepth = new Map<number, Story[]>()
        storiesData.forEach(story => {
          const depth = depths.get(story.id) || 0
          if (!byDepth.has(depth)) byDepth.set(depth, [])
          byDepth.get(depth)!.push(story)
        })

        // Sort each depth group by phase.epic.story_number
        byDepth.forEach(group => {
          group.sort((a, b) => {
            if (a.phase !== b.phase) return a.phase - b.phase
            if (a.epic !== b.epic) return a.epic - b.epic
            return a.story_number - b.story_number
          })
        })

        // Create nodes with positions
        const NODE_WIDTH = 170
        const NODE_HEIGHT = 70
        const H_GAP = direction === 'vertical' ? 80 : 60
        const V_GAP = direction === 'vertical' ? 70 : 20
        const MAX_PER_ROW = 6 // Max nodes per row in vertical mode

        const nodeList: Node[] = []
        const maxDepth = Math.max(...Array.from(depths.values()), 0)

        if (direction === 'horizontal') {
          // Horizontal mode: simple layout
          for (let depth = 0; depth <= maxDepth; depth++) {
            const group = byDepth.get(depth) || []
            group.forEach((story, idx) => {
              const status = getStoryStatus(story, currentStoryId)
              nodeList.push({
                id: story.id,
                type: 'story',
                position: { x: depth * (NODE_WIDTH + H_GAP), y: idx * (NODE_HEIGHT + V_GAP) },
                data: {
                  label: story.id,
                  title: story.title,
                  status,
                  phase: story.phase,
                  epic: story.epic,
                  direction,
                },
              })
            })
          }
        } else {
          // Vertical mode: limit to MAX_PER_ROW per row, wrap to new rows
          // Calculate max width for centering (capped at MAX_PER_ROW)
          const maxRowWidth = MAX_PER_ROW * NODE_WIDTH + (MAX_PER_ROW - 1) * H_GAP

          let currentRow = 0
          for (let depth = 0; depth <= maxDepth; depth++) {
            const group = byDepth.get(depth) || []

            // Split into chunks of MAX_PER_ROW
            for (let chunkStart = 0; chunkStart < group.length; chunkStart += MAX_PER_ROW) {
              const chunk = group.slice(chunkStart, chunkStart + MAX_PER_ROW)
              const chunkSize = chunk.length

              // Center this chunk within the max row width
              const rowWidth = chunkSize * NODE_WIDTH + (chunkSize - 1) * H_GAP
              const xOffset = (maxRowWidth - rowWidth) / 2

              chunk.forEach((story, idx) => {
                const status = getStoryStatus(story, currentStoryId)
                nodeList.push({
                  id: story.id,
                  type: 'story',
                  position: {
                    x: xOffset + idx * (NODE_WIDTH + H_GAP),
                    y: currentRow * (NODE_HEIGHT + V_GAP)
                  },
                  data: {
                    label: story.id,
                    title: story.title,
                    status,
                    phase: story.phase,
                    epic: story.epic,
                    direction,
                  },
                })
              })
              currentRow++
            }
          }
        }

        // Create edges
        const edgeList: Edge[] = []
        const nodeIds = new Set(storiesData.map(s => s.id))

        for (const story of storiesData) {
          if (story.depends_on) {
            for (const depId of story.depends_on) {
              if (nodeIds.has(depId)) {
                const depStory = storiesData.find(s => s.id === depId)
                const isDepMerged = depStory?.merged

                edgeList.push({
                  id: `${depId}->${story.id}`,
                  source: depId,
                  target: story.id,
                  type: 'smoothstep',
                  markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 12,
                    height: 12,
                  },
                  style: {
                    strokeWidth: 2,
                    stroke: isDepMerged ? '#22c55e' : '#6b7280',
                  },
                  animated: getStoryStatus(story, currentStoryId) === 'in_progress',
                })
              }
            }
          }
        }

        setNodes(nodeList)
        setEdges(edgeList)
        setStories(storiesData)
        setLoading(false)
      } catch (error) {
        console.error('Failed to fetch graph data:', error)
        setLoading(false)
      }
    }

    fetchData()

    // Refresh every 5 seconds
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [direction])

  return { nodes, edges, stories, loading }
}
