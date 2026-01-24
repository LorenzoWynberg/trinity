'use client'

import { useState, useEffect } from 'react'
import { Node, Edge, MarkerType } from '@xyflow/react'
import type { Story, StoryStatus } from '@/lib/types'

type GraphData = {
  nodes: Node[]
  edges: Edge[]
  stories: Story[]
  loading: boolean
  direction: 'horizontal' | 'vertical'
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

export function useGraphData(): GraphData {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>('horizontal')

  useEffect(() => {
    async function fetchData() {
      try {
        const [prdRes, stateRes, settingsRes] = await Promise.all([
          fetch('/api/prd'),
          fetch('/api/state'),
          fetch('/api/settings')
        ])

        const settings = await settingsRes.json()
        const currentDirection = settings?.graphDirection || 'horizontal'
        setDirection(currentDirection)

        const prd = await prdRes.json()
        const state = await stateRes.json()
        const currentStoryId = state?.current_story || null

        if (!prd?.stories) {
          setLoading(false)
          return
        }

        const stories: Story[] = prd.stories
        const depths = calculateDepths(stories)

        // Group stories by depth
        const byDepth = new Map<number, Story[]>()
        stories.forEach(story => {
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
        const H_GAP = 60
        const V_GAP = 20

        const nodeList: Node[] = []
        const maxDepth = Math.max(...Array.from(depths.values()), 0)

        for (let depth = 0; depth <= maxDepth; depth++) {
          const group = byDepth.get(depth) || []
          group.forEach((story, idx) => {
            const status = getStoryStatus(story, currentStoryId)

            // Calculate position based on direction
            const position = currentDirection === 'horizontal'
              ? { x: depth * (NODE_WIDTH + H_GAP), y: idx * (NODE_HEIGHT + V_GAP) }
              : { x: idx * (NODE_WIDTH + H_GAP), y: depth * (NODE_HEIGHT + V_GAP) }

            nodeList.push({
              id: story.id,
              type: 'story',
              position,
              data: {
                label: story.id,
                title: story.title,
                status,
                phase: story.phase,
                epic: story.epic,
                direction: currentDirection,
              },
            })
          })
        }

        // Create edges
        const edgeList: Edge[] = []
        const nodeIds = new Set(stories.map(s => s.id))

        for (const story of stories) {
          if (story.depends_on) {
            for (const depId of story.depends_on) {
              if (nodeIds.has(depId)) {
                const depStory = stories.find(s => s.id === depId)
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
        setStories(stories)
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
  }, [])

  return { nodes, edges, stories, loading, direction }
}
