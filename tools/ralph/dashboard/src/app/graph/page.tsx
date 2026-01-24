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
import { StoryNode } from '@/components/story-node'
import { StoryModal } from '@/components/story-modal'
import { useGraphData } from '@/hooks/use-graph-data'
import type { Story, StoryStatus } from '@/lib/types'

const nodeTypes = {
  story: StoryNode,
}

export default function GraphPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { nodes: initialNodes, edges: initialEdges, loading, stories } = useGraphData()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
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
    // Highlight the dependency path
    const ancestors = getAncestors(node.id)
    const pathEdges = getPathEdges(node.id)
    setHighlightedNodes(ancestors)
    setHighlightedEdges(pathEdges)
  }, [getAncestors, getPathEdges])

  const openStoryModal = useCallback((storyId: string, status: StoryStatus) => {
    const story = stories.find(s => s.id === storyId)
    if (story) {
      setSelectedStory(story)
      setSelectedStatus(status)
      setModalOpen(true)
    }
  }, [stories])

  const onPaneClick = useCallback(() => {
    setHighlightedNodes(new Set())
    setHighlightedEdges(new Set())
  }, [])

  // Apply highlighting styles to edges
  const defaultEdgeColor = isDark ? '#6b7280' : '#9ca3af'
  const styledEdges: Edge[] = edges.map(edge => ({
    ...edge,
    style: {
      ...edge.style,
      strokeWidth: highlightedEdges.has(edge.id) ? 4 : 2,
      stroke: highlightedEdges.has(edge.id) ? '#facc15' : (edge.style?.stroke || defaultEdgeColor),
      opacity: highlightedEdges.size > 0 && !highlightedEdges.has(edge.id) ? 0.2 : 1,
    },
    zIndex: highlightedEdges.has(edge.id) ? 1000 : 0,
  }))

  // Apply highlighting styles to nodes and add info click handler
  const styledNodes: Node[] = nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      onInfoClick: () => openStoryModal(node.id, node.data?.status as StoryStatus || 'pending'),
    },
    style: {
      ...node.style,
      opacity: highlightedNodes.size > 0 && !highlightedNodes.has(node.id) ? 0.3 : 1,
    },
  }))

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Loading graph...</p>
      </div>
    )
  }

  return (
    <>
      <div className="h-[calc(100vh-2rem)] w-full">
        <ReactFlow
          nodes={styledNodes}
          edges={styledEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.2 }}
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
          <Controls className={isDark ? '' : '[&>button]:bg-white [&>button]:border-gray-200'} />
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
