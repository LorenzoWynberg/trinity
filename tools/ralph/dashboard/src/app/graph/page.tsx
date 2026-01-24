'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useTheme } from 'next-themes'
import { ArrowRight, ArrowDown } from 'lucide-react'
import { StoryNode } from '@/components/story-node'
import { StoryModal } from '@/components/story-modal'
import { useGraphData } from '@/hooks/use-graph-data'
import { Button } from '@/components/ui/button'
import type { Story, StoryStatus } from '@/lib/types'

const nodeTypes = {
  story: StoryNode,
}

export default function GraphPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>('horizontal')
  const { nodes: initialNodes, edges: initialEdges, loading, stories } = useGraphData(direction)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Load saved direction on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.graphDirection) {
          setDirection(data.graphDirection)
        }
      })
      .catch(console.error)
  }, [])
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set())
  const [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(new Set())

  const [selectedStory, setSelectedStory] = useState<Story | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<StoryStatus>('pending')
  const [modalOpen, setModalOpen] = useState(false)

  // Update nodes when data loads
  useEffect(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes)
      setEdges(initialEdges)
    }
  }, [initialNodes, initialEdges, setNodes, setEdges])

  // Get all ancestors (dependencies) recursively
  const getAncestors = useCallback((nodeId: string, visited: Set<string> = new Set()): Set<string> => {
    if (visited.has(nodeId)) return visited
    visited.add(nodeId)

    const story = stories.find(s => s.id === nodeId)
    if (story?.depends_on) {
      story.depends_on.forEach(depId => {
        getAncestors(depId, visited)
      })
    }
    return visited
  }, [stories])

  // Get edges in the dependency path
  const getPathEdges = useCallback((nodeId: string): Set<string> => {
    const pathEdges = new Set<string>()
    const ancestors = getAncestors(nodeId)

    ancestors.forEach(ancestorId => {
      const story = stories.find(s => s.id === ancestorId)
      if (story?.depends_on) {
        story.depends_on.forEach(depId => {
          if (ancestors.has(depId)) {
            pathEdges.add(`${depId}->${ancestorId}`)
          }
        })
      }
    })

    return pathEdges
  }, [stories, getAncestors])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    // Toggle highlighting - if already highlighted, clear it
    if (highlightedNodes.has(node.id) && highlightedNodes.size === getAncestors(node.id).size) {
      setHighlightedNodes(new Set())
      setHighlightedEdges(new Set())
    } else {
      // Highlight the dependency path
      const ancestors = getAncestors(node.id)
      const pathEdges = getPathEdges(node.id)
      setHighlightedNodes(ancestors)
      setHighlightedEdges(pathEdges)
    }
  }, [getAncestors, getPathEdges, highlightedNodes])

  const openStoryModal = useCallback((storyId: string, status: StoryStatus) => {
    const story = stories.find(s => s.id === storyId)
    if (story) {
      setSelectedStory(story)
      setSelectedStatus(status)
      setModalOpen(true)
    }
  }, [stories])

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    // Open modal on double-click
    openStoryModal(node.id, node.data?.status as StoryStatus || 'pending')
  }, [openStoryModal])

  const onPaneClick = useCallback(() => {
    setHighlightedNodes(new Set())
    setHighlightedEdges(new Set())
  }, [])

  // Apply highlighting styles to edges
  const defaultEdgeColor = isDark ? '#6b7280' : '#9ca3af'
  const hasHighlighting = highlightedEdges.size > 0
  const styledEdges: Edge[] = edges.map(edge => {
    const isHighlighted = highlightedEdges.has(edge.id)
    return {
      ...edge,
      style: {
        ...edge.style,
        strokeWidth: isHighlighted ? 4 : 2,
        stroke: isHighlighted ? '#facc15' : (edge.style?.stroke || defaultEdgeColor),
        opacity: hasHighlighting && !isHighlighted ? 0 : 1,
      },
      zIndex: isHighlighted ? 1000 : 0,
    }
  })

  // Apply highlighting styles to nodes
  const styledNodes: Node[] = nodes.map(node => {
    const isHighlighted = highlightedNodes.has(node.id)
    const hasHighlighting = highlightedNodes.size > 0
    return {
      ...node,
      style: {
        ...node.style,
        opacity: hasHighlighting && !isHighlighted ? 0.3 : 1,
      },
      // Highlighted nodes on top, non-highlighted nodes below highlighted edges
      zIndex: isHighlighted ? 1001 : (hasHighlighting ? -1 : 0),
    }
  })

  const toggleDirection = async () => {
    const newDirection = direction === 'horizontal' ? 'vertical' : 'horizontal'
    setDirection(newDirection)

    // Save to settings
    try {
      const res = await fetch('/api/settings')
      const settings = await res.json()
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, graphDirection: newDirection }),
      })
    } catch (error) {
      console.error('Failed to save direction setting:', error)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Loading graph...</p>
      </div>
    )
  }

  return (
    <>
      <div className="h-[calc(100vh-2rem)] w-full relative">
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleDirection}
            className="gap-2"
          >
            {direction === 'horizontal' ? (
              <>
                <ArrowRight className="h-4 w-4" />
                Horizontal
              </>
            ) : (
              <>
                <ArrowDown className="h-4 w-4" />
                Vertical
              </>
            )}
          </Button>
        </div>
        <ReactFlow
          key={direction}
          nodes={styledNodes}
          edges={styledEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          minZoom={0.1}
          maxZoom={2}
          style={{ background: isDark ? '#0a0a0a' : '#f8fafc' }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color={isDark ? '#333' : '#ccc'}
          />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const status = node.data?.status as string
              switch (status) {
                case 'merged': return '#22c55e'
                case 'passed': return '#eab308'
                case 'in_progress': return '#3b82f6'
                case 'skipped': return '#a855f7'
                case 'blocked': return '#ef4444'
                default: return isDark ? '#6b7280' : '#9ca3af'
              }
            }}
            maskColor={isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)'}
            style={{ background: isDark ? '#1a1a1a' : '#f1f5f9' }}
          />
        </ReactFlow>
      </div>

      <StoryModal
        story={selectedStory}
        status={selectedStatus}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open) {
            setHighlightedNodes(new Set())
            setHighlightedEdges(new Set())
          }
        }}
      />
    </>
  )
}
