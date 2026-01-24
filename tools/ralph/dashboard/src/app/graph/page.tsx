'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
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
  ReactFlowProvider,
  useReactFlow,
  NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useTheme } from 'next-themes'
import { ArrowRight, ArrowDown, Save, Trash2, X } from 'lucide-react'
import { StoryNode } from '@/components/story-node'
import { VersionNode } from '@/components/version-node'
import { StoryModal } from '@/components/story-modal'
import { useGraphData, calculateAutoPositions, GraphLayoutData } from '@/hooks/use-graph-data'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Story, StoryStatus } from '@/lib/types'

const nodeTypes = {
  story: StoryNode,
  version: VersionNode,
}

function GraphContent() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [selectedVersion, setSelectedVersion] = useState<string>('all')
  const {
    nodes: initialNodes,
    edges: initialEdges,
    loading,
    stories,
    versions,
    layoutData,
    saveLayoutData,
    deleteCustomLayout,
  } = useGraphData(selectedVersion)
  const { fitView } = useReactFlow()
  const shouldFitViewRef = useRef(true)
  const prevVersionRef = useRef(selectedVersion)
  const prevActiveRef = useRef(layoutData.active)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set())
  const [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(new Set())

  const [selectedStory, setSelectedStory] = useState<Story | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<StoryStatus>('pending')
  const [modalOpen, setModalOpen] = useState(false)

  // Save dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [newLayoutName, setNewLayoutName] = useState('')

  // Track version/layout changes to trigger fitView
  useEffect(() => {
    if (prevVersionRef.current !== selectedVersion || prevActiveRef.current !== layoutData.active) {
      shouldFitViewRef.current = true
      prevVersionRef.current = selectedVersion
      prevActiveRef.current = layoutData.active
    }
  }, [selectedVersion, layoutData.active])

  // Update nodes when data loads
  useEffect(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes)
      setEdges(initialEdges)

      if (shouldFitViewRef.current) {
        setTimeout(() => {
          fitView({ padding: 0.1, duration: 200 })
        }, 50)
        shouldFitViewRef.current = false
      }
    }
  }, [initialNodes, initialEdges, setNodes, setEdges, fitView])

  // Handle layout selection change
  const handleLayoutChange = useCallback(async (value: string) => {
    if (value === '__create__') {
      setSaveDialogOpen(true)
      return
    }

    const newData: GraphLayoutData = {
      ...layoutData,
      active: value,
    }
    await saveLayoutData(newData)

    // Fit view after layout change
    setTimeout(() => {
      fitView({ padding: 0.1, duration: 200 })
    }, 50)
  }, [layoutData, saveLayoutData, fitView])

  // Save current positions as a new custom layout
  const handleSaveNewLayout = useCallback(async () => {
    if (!newLayoutName.trim()) return

    const positions: Record<string, { x: number; y: number }> = {}
    nodes.forEach(node => {
      positions[node.id] = { x: node.position.x, y: node.position.y }
    })

    const newData: GraphLayoutData = {
      active: newLayoutName.trim(),
      customLayouts: {
        ...layoutData.customLayouts,
        [newLayoutName.trim()]: { positions },
      },
    }

    await saveLayoutData(newData)
    setSaveDialogOpen(false)
    setNewLayoutName('')
  }, [nodes, layoutData, saveLayoutData, newLayoutName])

  // Handle node drag end - update custom layout if active
  const handleNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    onNodesChange(changes)

    const hasDrag = changes.some(change =>
      change.type === 'position' && change.dragging === false && change.position
    )

    if (hasDrag) {
      const activeLayout = layoutData.active

      // If currently on a custom layout, update its positions
      if (activeLayout !== 'horizontal' && activeLayout !== 'vertical') {
        const positions: Record<string, { x: number; y: number }> = {}
        nodes.forEach(node => {
          const change = changes.find(c => c.type === 'position' && c.id === node.id)
          if (change && change.type === 'position' && change.position) {
            positions[node.id] = { x: change.position.x, y: change.position.y }
          } else {
            positions[node.id] = { x: node.position.x, y: node.position.y }
          }
        })

        const newData: GraphLayoutData = {
          ...layoutData,
          customLayouts: {
            ...layoutData.customLayouts,
            [activeLayout]: { positions },
          },
        }
        saveLayoutData(newData)
      }
    }
  }, [onNodesChange, layoutData, nodes, saveLayoutData])

  // Delete a custom layout
  const handleDeleteLayout = useCallback(async (name: string) => {
    await deleteCustomLayout(name)
  }, [deleteCustomLayout])

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
    if (highlightedNodes.has(node.id) && highlightedNodes.size === getAncestors(node.id).size) {
      setHighlightedNodes(new Set())
      setHighlightedEdges(new Set())
    } else {
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
      zIndex: isHighlighted ? 1001 : (hasHighlighting ? -1 : 0),
    }
  })

  // Get list of custom layout names
  const customLayoutNames = Object.keys(layoutData.customLayouts || {})

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
        {/* Version Selector - Left */}
        {versions.length >= 1 && (
          <div className="absolute top-4 left-4 z-10">
            <Select value={selectedVersion} onValueChange={setSelectedVersion}>
              <SelectTrigger className="w-[120px] h-9 bg-background">
                <SelectValue placeholder="All versions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All versions</SelectItem>
                {versions.map(version => (
                  <SelectItem key={version} value={version}>
                    {version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Layout Selector - Right */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <Select value={layoutData.active} onValueChange={handleLayoutChange}>
            <SelectTrigger className="w-[160px] h-9 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="horizontal">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Horizontal
                </div>
              </SelectItem>
              <SelectItem value="vertical">
                <div className="flex items-center gap-2">
                  <ArrowDown className="h-4 w-4" />
                  Vertical
                </div>
              </SelectItem>
              {customLayoutNames.length > 0 && (
                <div className="border-t my-1" />
              )}
              {customLayoutNames.map(name => (
                <SelectItem key={name} value={name}>
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="truncate">{name}</span>
                  </div>
                </SelectItem>
              ))}
              <div className="border-t my-1" />
              <SelectItem value="__create__">
                <div className="flex items-center gap-2 text-primary">
                  <Save className="h-4 w-4" />
                  Create view...
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Delete button for custom layouts */}
          {layoutData.active !== 'horizontal' && layoutData.active !== 'vertical' && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => handleDeleteLayout(layoutData.active)}
              title="Delete this layout"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>

        <ReactFlow
          nodes={styledNodes}
          edges={styledEdges}
          onNodesChange={handleNodesChange}
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

      {/* Create View Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create View</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">View Name</label>
            <input
              type="text"
              value={newLayoutName}
              onChange={(e) => setNewLayoutName(e.target.value)}
              placeholder="e.g., By Phase, Compact, My Layout"
              className="w-full px-3 py-2 border rounded-md bg-background"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNewLayout()
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNewLayout} disabled={!newLayoutName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function GraphPage() {
  return (
    <ReactFlowProvider>
      <GraphContent />
    </ReactFlowProvider>
  )
}
