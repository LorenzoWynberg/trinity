'use client'

import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { useDebouncer } from '@tanstack/react-pacer'
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
import { ArrowRight, ArrowDown, Save, Trash2, Loader2, Star, Maximize, Minimize } from 'lucide-react'
import { StoryNode } from '@/components/story-node'
import { VersionNode } from '@/components/version-node'
import { StoryModal } from '@/components/story-modal'
import { useGraphData, calculateAutoPositions, resolveDependency, GraphLayoutData } from '@/hooks/use-graph-data'
import { cn } from '@/lib/utils'
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
  const [mounted, setMounted] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<string>('all')
  const [isVersionLoading, setIsVersionLoading] = useState(false)
  const [isLayoutLoading, setIsLayoutLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === 'dark' : true
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

  // Debounced layout save - waits 500ms after last change before saving
  const layoutSaveDebouncer = useDebouncer(saveLayoutData, { wait: 500 })

  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set())
  const [highlightedEdges, setHighlightedEdges] = useState<Map<string, number>>(new Map()) // edgeId -> depth

  const [selectedStory, setSelectedStory] = useState<Story | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<StoryStatus>('pending')
  const [modalOpen, setModalOpen] = useState(false)

  // Save dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [newLayoutName, setNewLayoutName] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showDeadEnds, setShowDeadEnds] = useState(false)

  // Load showDeadEnds setting on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.showDeadEnds !== undefined) {
          setShowDeadEnds(data.showDeadEnds)
        }
      })
      .catch(() => {})
  }, [])

  // Save showDeadEnds setting when toggled
  const toggleDeadEnds = useCallback(() => {
    const newValue = !showDeadEnds
    setShowDeadEnds(newValue)
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showDeadEnds: newValue })
    }).catch(() => {})
  }, [showDeadEnds])

  // Track fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

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
          setIsVersionLoading(false)
          setIsLayoutLoading(false)
        }, 50)
        shouldFitViewRef.current = false
      } else {
        setIsVersionLoading(false)
        setIsLayoutLoading(false)
      }
    }
  }, [initialNodes, initialEdges, setNodes, setEdges, fitView])

  // Handle layout selection change
  const handleLayoutChange = useCallback(async (value: string) => {
    if (value === '__create__') {
      setSaveDialogOpen(true)
      return
    }

    setIsLayoutLoading(true)

    const newData: GraphLayoutData = {
      ...layoutData,
      active: value,
    }
    await saveLayoutData(newData)
  }, [layoutData, saveLayoutData])

  // Save current positions as a new custom layout
  const handleSaveNewLayout = useCallback(async () => {
    if (!newLayoutName.trim()) return

    const positions: Record<string, { x: number; y: number }> = {}
    nodes.forEach(node => {
      positions[node.id] = { x: node.position.x, y: node.position.y }
    })

    const newData: GraphLayoutData = {
      active: newLayoutName.trim(),
      defaultLayout: layoutData.defaultLayout,
      customLayouts: {
        ...layoutData.customLayouts,
        [newLayoutName.trim()]: { positions },
      },
    }

    await saveLayoutData(newData)
    setSaveDialogOpen(false)
    setNewLayoutName('')
  }, [nodes, layoutData, saveLayoutData, newLayoutName])

  // Handle node drag end - update custom layout if active (debounced)
  const handleNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    onNodesChange(changes)

    const hasDrag = changes.some(change =>
      change.type === 'position' && change.dragging === false && change.position
    )

    if (hasDrag) {
      const activeLayout = layoutData.active

      // If currently on a custom layout, update its positions (debounced)
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
        // Use debounced save to avoid rapid API calls while dragging
        layoutSaveDebouncer.maybeExecute(newData)
      }
    }
  }, [onNodesChange, layoutData, nodes, layoutSaveDebouncer])

  // Delete a custom layout
  const handleDeleteLayout = useCallback(async (name: string) => {
    await deleteCustomLayout(name)
  }, [deleteCustomLayout])

  // Set current layout as default for this version
  const handleSetDefault = useCallback(async () => {
    const newData: GraphLayoutData = {
      ...layoutData,
      defaultLayout: layoutData.active,
    }
    await saveLayoutData(newData)
  }, [layoutData, saveLayoutData])

  // Toggle fullscreen mode
  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  // Get all ancestors (dependencies) recursively - handles phase/epic deps
  const getAncestors = useCallback((nodeId: string, visited: Set<string> = new Set()): Set<string> => {
    if (visited.has(nodeId)) return visited
    visited.add(nodeId)

    const story = stories.find(s => s.id === nodeId)
    if (story?.depends_on && story.depends_on.length > 0) {
      story.depends_on.forEach(depRef => {
        const resolvedIds = resolveDependency(depRef, stories)
        resolvedIds.forEach(depId => getAncestors(depId, visited))
      })
    } else if (story?.target_version) {
      // Root story - add version node as ancestor
      visited.add(`version:${story.target_version}`)
    }
    return visited
  }, [stories])

  // Get edges in the dependency path with depth (distance from clicked node)
  const getPathEdgesWithDepth = useCallback((nodeId: string, ancestors: Set<string>): Map<string, number> => {
    const edgeDepths = new Map<string, number>()
    const nodeDepths = new Map<string, number>()

    // BFS to calculate node depths from the clicked node
    const queue: [string, number][] = [[nodeId, 0]]
    while (queue.length > 0) {
      const [id, depth] = queue.shift()!
      if (nodeDepths.has(id)) continue
      nodeDepths.set(id, depth)

      const story = stories.find(s => s.id === id)
      if (story?.depends_on) {
        story.depends_on.forEach(depRef => {
          const resolvedIds = resolveDependency(depRef, stories)
          resolvedIds.forEach(depId => {
            if (ancestors.has(depId) && !nodeDepths.has(depId)) {
              queue.push([depId, depth + 1])
            }
          })
        })
      }
    }

    // Find max depth to invert (so roots are yellow, clicked node is blue)
    const maxDepth = Math.max(...Array.from(nodeDepths.values()))

    // Now create edges with inverted depth (version=0/yellow, roots=1, clicked=max/blue)
    ancestors.forEach(ancestorId => {
      // Skip version nodes when creating story-to-story edges
      if (ancestorId.startsWith('version:')) return

      const story = stories.find(s => s.id === ancestorId)
      if (story?.depends_on && story.depends_on.length > 0) {
        story.depends_on.forEach(depRef => {
          const resolvedIds = resolveDependency(depRef, stories)
          resolvedIds.forEach(depId => {
            if (ancestors.has(depId)) {
              const edgeId = `${depId}->${ancestorId}`
              const nodeDepth = nodeDepths.get(ancestorId) || 0
              edgeDepths.set(edgeId, maxDepth - nodeDepth + 1) // +1 to leave room for version edge at 0
            }
          })
        })
      } else if (story?.target_version) {
        // Root story - add edge from version node (depth 0 = yellow, the very start)
        const versionNodeId = `version:${story.target_version}`
        if (ancestors.has(versionNodeId)) {
          const edgeId = `${versionNodeId}->${ancestorId}`
          edgeDepths.set(edgeId, 0) // version edge is always the start (yellow)
        }
      }
    })

    return edgeDepths
  }, [stories])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (highlightedNodes.has(node.id) && highlightedNodes.size === getAncestors(node.id).size) {
      setHighlightedNodes(new Set())
      setHighlightedEdges(new Map())
    } else {
      const ancestors = getAncestors(node.id)
      const pathEdges = getPathEdgesWithDepth(node.id, ancestors)
      setHighlightedNodes(ancestors)
      setHighlightedEdges(pathEdges)
    }
  }, [getAncestors, getPathEdgesWithDepth, highlightedNodes])

  const openStoryModal = useCallback((storyId: string, status: StoryStatus) => {
    const story = stories.find(s => s.id === storyId)
    if (story) {
      setSelectedStory(story)
      setSelectedStatus(status)
      setModalOpen(true)
    }
  }, [stories])

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    // Only open modal for story nodes, not version headers
    if (node.type === 'story') {
      openStoryModal(node.id, node.data?.status as StoryStatus || 'pending')
    }
  }, [openStoryModal])

  const onPaneClick = useCallback(() => {
    setHighlightedNodes(new Set())
    setHighlightedEdges(new Map())
  }, [])

  // Depth-based colors for highlighted edges (rainbow gradient from roots to clicked)
  const depthColors = [
    '#facc15', // 0 - yellow
    '#eab308', // 1 - yellow-dark
    '#f97316', // 2 - orange
    '#ea580c', // 3 - orange-dark
    '#ef4444', // 4 - red
    '#dc2626', // 5 - red-dark
    '#ec4899', // 6 - pink
    '#db2777', // 7 - pink-dark
    '#a855f7', // 8 - purple
    '#9333ea', // 9 - purple-dark
    '#6366f1', // 10 - indigo
    '#4f46e5', // 11 - indigo-dark
    '#3b82f6', // 12+ - blue
  ]

  // Get max depth from highlighted edges
  const maxHighlightDepth = highlightedEdges.size > 0
    ? Math.max(...Array.from(highlightedEdges.values()))
    : 0

  // When depth <= 6, use every other color for better spread
  const getDepthColor = (depth: number) => {
    if (maxHighlightDepth <= 6) {
      // Use every other color (0, 2, 4, 6, 8, 10, 12)
      const stretchedIndex = Math.min(depth * 2, depthColors.length - 1)
      return depthColors[stretchedIndex]
    }
    return depthColors[Math.min(depth, depthColors.length - 1)]
  }

  // Apply highlighting styles to edges
  const defaultEdgeColor = isDark ? '#6b7280' : '#9ca3af'
  const hasHighlighting = highlightedEdges.size > 0
  const styledEdges: Edge[] = edges.map(edge => {
    const isHighlighted = highlightedEdges.has(edge.id)
    const depth = highlightedEdges.get(edge.id) ?? 0
    return {
      ...edge,
      style: {
        ...edge.style,
        strokeWidth: isHighlighted ? 4 : 2,
        stroke: isHighlighted ? getDepthColor(depth) : (edge.style?.stroke || defaultEdgeColor),
        opacity: hasHighlighting && !isHighlighted ? 0 : 1,
      },
      zIndex: isHighlighted ? 1000 - depth : 0, // closer edges on top
    }
  })

  // Apply highlighting styles to nodes
  const styledNodes: Node[] = nodes.map(node => {
    const isHighlighted = highlightedNodes.has(node.id)
    const hasHighlighting = highlightedNodes.size > 0
    return {
      ...node,
      data: {
        ...node.data,
        showDeadEnd: showDeadEnds && node.data?.isDeadEnd,
      },
      style: {
        ...node.style,
        opacity: hasHighlighting && !isHighlighted ? 0.3 : 1,
      },
      zIndex: isHighlighted ? 1001 : (hasHighlighting ? -1 : 0),
    }
  })

  // Get list of custom layout names (filter out any empty/undefined keys)
  const customLayoutNames = Object.keys(layoutData.customLayouts || {}).filter(name => name && name !== 'undefined')

  // Determine if we're in auto-layout mode (no manual positioning allowed)
  const isAutoLayout = layoutData.active === 'horizontal' || layoutData.active === 'vertical' || layoutData.active === 'horizontal-compact' || layoutData.active === 'vertical-compact'

  return (
    <>
      <div className="h-[calc(100vh-2rem)] w-full relative">
        {/* Initial loading overlay */}
        {(!mounted || loading) && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading graph...</p>
            </div>
          </div>
        )}

        {/* Version Selector - Left */}
        {versions.length >= 1 && (
          <div className="absolute top-4 left-4 z-10">
            <Select
              value={selectedVersion}
              onValueChange={(v) => {
                setIsVersionLoading(true)
                setSelectedVersion(v)
              }}
              disabled={isVersionLoading || isLayoutLoading}
            >
              <SelectTrigger className="w-[140px] h-9 bg-background">
                {isVersionLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading...</span>
                  </div>
                ) : (
                  <SelectValue placeholder="All versions" />
                )}
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
          <Select
            value={layoutData.active}
            onValueChange={handleLayoutChange}
            disabled={isVersionLoading || isLayoutLoading}
          >
            <SelectTrigger className="w-[160px] h-9 bg-background">
              {isLayoutLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : (
                <SelectValue />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="horizontal">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Horizontal
                </div>
              </SelectItem>
              <SelectItem value="horizontal-compact">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Horizontal Compact
                </div>
              </SelectItem>
              <SelectItem value="vertical">
                <div className="flex items-center gap-2">
                  <ArrowDown className="h-4 w-4" />
                  Vertical
                </div>
              </SelectItem>
              <SelectItem value="vertical-compact">
                <div className="flex items-center gap-2">
                  <ArrowDown className="h-4 w-4" />
                  Vertical Compact
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

          {/* Dead ends toggle */}
          <Button
            variant="outline"
            size="sm"
            className={cn("h-9 gap-2", showDeadEnds && "bg-orange-500/20 border-orange-500")}
            onClick={toggleDeadEnds}
            title="Show dead-end nodes"
          >
            <div className={cn("w-2 h-2 rounded-full", showDeadEnds ? "bg-orange-500" : "bg-muted-foreground")} />
            <span className="text-xs">Dead ends</span>
          </Button>

          {/* Set as default button */}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={handleSetDefault}
            title={layoutData.active === layoutData.defaultLayout ? "Current default" : "Set as default"}
            disabled={isVersionLoading || isLayoutLoading || layoutData.active === layoutData.defaultLayout}
          >
            <Star
              className={`h-4 w-4 ${layoutData.active === layoutData.defaultLayout ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`}
            />
          </Button>

          {/* Delete button for custom layouts */}
          {!isAutoLayout && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => handleDeleteLayout(layoutData.active)}
              title="Delete this layout"
              disabled={isVersionLoading || isLayoutLoading}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}

          {/* Fullscreen button */}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={handleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
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
          zoomOnDoubleClick={false}
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
          <Controls showInteractive={!isAutoLayout} />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === 'version') return isDark ? '#a855f7' : '#9333ea'
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
            setHighlightedEdges(new Map())
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
