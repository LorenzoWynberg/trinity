'use client'

import { useState, useEffect } from 'react'
import { Node, Edge, MarkerType } from '@xyflow/react'
import type { Story, StoryStatus } from '@/lib/types'

type GraphData = {
  nodes: Node[]
  edges: Edge[]
  loading: boolean
}

function getStoryStatus(story: Story, currentStoryId: string | null): StoryStatus {
  if (story.skipped) return 'skipped'
  if (story.merged) return 'merged'
  if (story.passes) return 'passed'
  if (story.id === currentStoryId) return 'in_progress'
  return 'pending'
}

export function useGraphData(): GraphData {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [prdRes, stateRes] = await Promise.all([
          fetch('/api/prd'),
          fetch('/api/state')
        ])

        const prd = await prdRes.json()
        const state = await stateRes.json()
        const currentStoryId = state?.current_story || null

        if (!prd?.stories) {
          setLoading(false)
          return
        }

        const stories: Story[] = prd.stories

        // Group stories by phase and epic for layout
        const groups = new Map<string, Story[]>()
        for (const story of stories) {
          const key = `${story.phase}-${story.epic}`
          if (!groups.has(key)) {
            groups.set(key, [])
          }
          groups.get(key)!.push(story)
        }

        // Calculate positions using a hierarchical layout
        const nodeMap = new Map<string, Node>()
        const HORIZONTAL_SPACING = 220
        const VERTICAL_SPACING = 120
        const EPIC_SPACING = 100

        // Sort groups by phase then epic
        const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
          const [aPhase, aEpic] = a[0].split('-').map(Number)
          const [bPhase, bEpic] = b[0].split('-').map(Number)
          if (aPhase !== bPhase) return aPhase - bPhase
          return aEpic - bEpic
        })

        let currentY = 0
        for (const [groupKey, groupStories] of sortedGroups) {
          // Sort stories within group by story_number
          groupStories.sort((a, b) => a.story_number - b.story_number)

          // Position stories in a row
          groupStories.forEach((story, index) => {
            const status = getStoryStatus(story, currentStoryId)
            const node: Node = {
              id: story.id,
              type: 'story',
              position: {
                x: index * HORIZONTAL_SPACING,
                y: currentY,
              },
              data: {
                label: story.id,
                title: story.title,
                status,
                phase: story.phase,
                epic: story.epic,
              },
            }
            nodeMap.set(story.id, node)
          })

          currentY += VERTICAL_SPACING + EPIC_SPACING
        }

        // Create edges from dependencies
        const edgeList: Edge[] = []
        for (const story of stories) {
          if (story.depends_on) {
            for (const depId of story.depends_on) {
              if (nodeMap.has(depId)) {
                edgeList.push({
                  id: `${depId}->${story.id}`,
                  source: depId,
                  target: story.id,
                  markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 15,
                    height: 15,
                  },
                  style: {
                    strokeWidth: 2,
                    stroke: '#6b7280',
                  },
                  animated: getStoryStatus(story, currentStoryId) === 'in_progress',
                })
              }
            }
          }
        }

        setNodes(Array.from(nodeMap.values()))
        setEdges(edgeList)
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

  return { nodes, edges, loading }
}
