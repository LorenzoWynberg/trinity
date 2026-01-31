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
import { ArrowRight, ArrowDown, Save, Trash2, Loader2, Star, Maximize, Minimize, SlidersHorizontal } from 'lucide-react'
import { StoryNode } from '@/components/story-node'
import { VersionNode } from '@/components/version-node'
import { StoryModal } from '@/components/story-modal'
import { useGraphData, resolveDependency, GraphLayoutData } from '@/hooks/use-graph-data'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
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
  const [mounted, setMounted] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<string>('all')
  const [isVersionLoading, setIsVersionLoading] = useState(false)
  const [isLayoutLoading, setIsLayoutLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const {
    nodes: initialNodes,
    edges: initialEdges,
    loading,
    stories,
    versions,
    versionProgress,
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
  const [highlightedEdges, setHighlightedEdges] = useState<Map<string, { depth: number; version: string }>>(new Map()) // edgeId -> {depth, version}
  const [maxDepthPerVersion, setMaxDepthPerVersion] = useState<Map<string, number>>(new Map())

  const [selectedStory, setSelectedStory] = useState<Story | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<StoryStatus>('pending')
  const [modalOpen, setModalOpen] = useState(false)

  // Save dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [newLayoutName, setNewLayoutName] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showDeadEnds, setShowDeadEnds] = useState(false)
  const [showExternalDeps, setShowExternalDeps] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Load settings on mount
  useEffect(() => {
    api.settings.get()
      .then(data => {
        if (data.showDeadEnds !== undefined) {
          setShowDeadEnds(data.showDeadEnds)
        }
        if (data.showExternalDeps !== undefined) {
          setShowExternalDeps(data.showExternalDeps)
        }
      })
      .catch(() => {})
  }, [])

  // Save showDeadEnds setting when toggled
  const toggleDeadEnds = useCallback(() => {
    const newValue = !showDeadEnds
    setShowDeadEnds(newValue)
    api.settings.update({ showDeadEnds: newValue }).catch(() => {})
  }, [showDeadEnds])

  // Save showExternalDeps setting when toggled
  const toggleExternalDeps = useCallback(() => {
    const newValue = !showExternalDeps
    setShowExternalDeps(newValue)
    api.settings.update({ showExternalDeps: newValue }).catch(() => {})
  }, [showExternalDeps])

  // Check for fullscreen API support (not available on iOS Safari)
  const [fullscreenSupported, setFullscreenSupported] = useState(true)

  useEffect(() => {
    // Detect fullscreen API support
    const doc = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>
    }
    const hasFullscreen = !!(
      doc.requestFullscreen ||
      doc.webkitRequestFullscreen
    )
    setFullscreenSupported(hasFullscreen)
  }, [])

  // Track fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element }
      setIsFullscreen(!!(document.fullscreenElement || doc.webkitFullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
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
    setIsLayoutLoading(true)
    await deleteCustomLayout(name)
    setIsLayoutLoading(false)
  }, [deleteCustomLayout])

  // Set current layout as default for this version
  const handleSetDefault = useCallback(async () => {
    const newData: GraphLayoutData = {
      ...layoutData,
      defaultLayout: layoutData.active,
    }
    await saveLayoutData(newData)
  }, [layoutData, saveLayoutData])

  // Toggle fullscreen mode (with vendor prefix support and CSS fallback)
  const handleFullscreen = useCallback(() => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element
      webkitExitFullscreen?: () => Promise<void>
    }
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>
    }

    const isNativeFullscreen = !!(document.fullscreenElement || doc.webkitFullscreenElement)

    if (!isFullscreen && !isNativeFullscreen) {
      // Try to enter fullscreen
      if (fullscreenSupported) {
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch(() => {
            // If native fails, fall back to CSS-based
            setIsFullscreen(true)
          })
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen()
        }
      } else {
        // No native support (iOS), use CSS-based fullscreen
        setIsFullscreen(true)
      }
    } else {
      // Exit fullscreen
      if (isNativeFullscreen) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {})
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen()
        }
      }
      // Always clear state for CSS-based fullscreen
      setIsFullscreen(false)
    }
  }, [isFullscreen, fullscreenSupported])

  // Extract storyId from versioned nodeId (e.g., "v1.0:1.1.1" -> "1.1.1")
  const extractStoryId = useCallback((nodeId: string): string => {
    if (nodeId.startsWith('version:')) return nodeId
    const parts = nodeId.split(':')
    return parts.length > 1 ? parts[1] : nodeId
  }, [])

  // Get version from nodeId (e.g., "v1.0:1.1.1" -> "v1.0")
  const extractVersion = useCallback((nodeId: string): string | null => {
    if (nodeId.startsWith('version:')) return nodeId.replace('version:', '')
    const parts = nodeId.split(':')
    return parts.length > 1 ? parts[0] : null
  }, [])

  // Get all ancestors (dependencies) recursively - handles phase/epic deps
  // Version nodes are at the END now, so clicking version shows all stories flowing into it
  const getAncestors = useCallback((nodeId: string, visited: Set<string> = new Set()): Set<string> => {
    if (visited.has(nodeId)) return visited
    visited.add(nodeId)

    // If clicking a version node, show all stories in that version as "dependencies"
    if (nodeId.startsWith('version:')) {
      const ver = nodeId.replace('version:', '')
      stories.filter(s => s.target_version === ver).forEach(s => {
        getAncestors(`${ver}:${s.id}`, visited)
      })
      return visited
    }

    const storyId = extractStoryId(nodeId)
    const version = extractVersion(nodeId)
    const story = stories.find(s => s.id === storyId && (!version || s.target_version === version))
    if (story?.depends_on && story.depends_on.length > 0) {
      story.depends_on.forEach(depRef => {
        // Whole version dep (e.g., "v1.0") - add version node and its stories
        if (/^v[0-9]+\.[0-9]+$/.test(depRef)) {
          visited.add(`version:${depRef}`)
          // Also add all stories from that version
          stories.filter(s => s.target_version === depRef).forEach(s => {
            getAncestors(`${depRef}:${s.id}`, visited)
          })
          return
        }
        const resolved = resolveDependency(depRef, stories, story.target_version)
        resolved.forEach(r => getAncestors(r.nodeId, visited))
      })
    }
    // Don't add version as ancestor for root stories - version is at the END now
    return visited
  }, [stories, extractStoryId, extractVersion])

  // Build a set of leaf story IDs (stories nothing in same version depends on)
  const leafStoryIds = useMemo(() => {
    const dependedOn = new Set<string>()
    stories.forEach(story => {
      story.depends_on?.forEach(depRef => {
        const resolved = resolveDependency(depRef, stories, story.target_version)
        resolved.forEach(r => {
          // Only count same-version dependencies for leaf detection
          if (!r.crossVersion) {
            dependedOn.add(r.nodeId)
          }
        })
      })
    })
    return new Set(
      stories
        .filter(s => !dependedOn.has(`${s.target_version}:${s.id}`))
        .map(s => `${s.target_version}:${s.id}`)
    )
  }, [stories])

  // Get edges in the dependency path with depth (distance from clicked node) per version
  const getPathEdgesWithDepth = useCallback((nodeId: string, ancestors: Set<string>): { edges: Map<string, { depth: number; version: string }>; maxPerVersion: Map<string, number> } => {
    const edgeDepths = new Map<string, { depth: number; version: string }>()
    const nodeDepths = new Map<string, number>()
    const nodeVersions = new Map<string, string>() // Track which version each node belongs to

    // BFS to calculate node depths from the clicked node
    const queue: [string, number][] = [[nodeId, 0]]
    while (queue.length > 0) {
      const [id, depth] = queue.shift()!
      if (nodeDepths.has(id)) continue
      nodeDepths.set(id, depth)

      // Track version for this node
      if (id.startsWith('version:')) {
        nodeVersions.set(id, id.replace('version:', ''))
      } else {
        const ver = extractVersion(id)
        if (ver) nodeVersions.set(id, ver)
      }

      // Version nodes: their deps are all stories in that version
      if (id.startsWith('version:')) {
        const ver = id.replace('version:', '')
        stories.filter(s => s.target_version === ver).forEach(s => {
          const storyNodeId = `${ver}:${s.id}`
          if (ancestors.has(storyNodeId) && !nodeDepths.has(storyNodeId)) {
            queue.push([storyNodeId, depth + 1])
          }
        })
        continue
      }

      const storyId = extractStoryId(id)
      const version = extractVersion(id)
      const story = stories.find(s => s.id === storyId && (!version || s.target_version === version))
      if (story?.depends_on) {
        story.depends_on.forEach(depRef => {
          // Whole version dep - add version node to queue
          if (/^v[0-9]+\.[0-9]+$/.test(depRef)) {
            const versionNodeId = `version:${depRef}`
            if (ancestors.has(versionNodeId) && !nodeDepths.has(versionNodeId)) {
              queue.push([versionNodeId, depth + 1])
            }
            return
          }
          const resolved = resolveDependency(depRef, stories, story.target_version)
          resolved.forEach(r => {
            if (ancestors.has(r.nodeId) && !nodeDepths.has(r.nodeId)) {
              queue.push([r.nodeId, depth + 1])
            }
          })
        })
      }
    }

    // Calculate max depth per version (for color normalization)
    const maxPerVersion = new Map<string, number>()
    nodeDepths.forEach((depth, nodeId) => {
      const ver = nodeVersions.get(nodeId)
      if (ver) {
        const current = maxPerVersion.get(ver) || 0
        if (depth > current) maxPerVersion.set(ver, depth)
      }
    })

    // Calculate depth offset per version (so each version's depth starts from 0)
    const minDepthPerVersion = new Map<string, number>()
    nodeDepths.forEach((depth, nodeId) => {
      const ver = nodeVersions.get(nodeId)
      if (ver) {
        const current = minDepthPerVersion.get(ver)
        if (current === undefined || depth < current) minDepthPerVersion.set(ver, depth)
      }
    })

    // Create edges with version-relative depth
    ancestors.forEach(ancestorId => {
      // Version node: create edges FROM leaf stories TO version
      if (ancestorId.startsWith('version:')) {
        const ver = ancestorId.replace('version:', '')
        stories.filter(s => s.target_version === ver).forEach(s => {
          const storyNodeId = `${ver}:${s.id}`
          if (ancestors.has(storyNodeId) && leafStoryIds.has(storyNodeId)) {
            const edgeId = `${storyNodeId}->${ancestorId}`
            const globalDepth = nodeDepths.get(ancestorId) || 0
            const minDepth = minDepthPerVersion.get(ver) || 0
            edgeDepths.set(edgeId, { depth: globalDepth - minDepth, version: ver })
          }
        })
        return
      }

      const storyId = extractStoryId(ancestorId)
      const version = extractVersion(ancestorId)
      const story = stories.find(s => s.id === storyId && (!version || s.target_version === version))
      if (story?.depends_on && story.depends_on.length > 0) {
        story.depends_on.forEach(depRef => {
          // Whole version dep - create version → story edge (cross-version edge belongs to target version)
          if (/^v[0-9]+\.[0-9]+$/.test(depRef)) {
            const versionNodeId = `version:${depRef}`
            if (ancestors.has(versionNodeId)) {
              const edgeId = `${versionNodeId}->${ancestorId}`
              const globalDepth = nodeDepths.get(ancestorId) || 0
              // Cross-version edge: use the target story's version for coloring
              const edgeVersion = version || 'unknown'
              const minDepth = minDepthPerVersion.get(edgeVersion) || 0
              edgeDepths.set(edgeId, { depth: globalDepth - minDepth, version: edgeVersion })
            }
            return
          }
          const resolved = resolveDependency(depRef, stories, story.target_version)
          resolved.forEach(r => {
            if (ancestors.has(r.nodeId)) {
              const edgeId = `${r.nodeId}->${ancestorId}`
              const globalDepth = nodeDepths.get(ancestorId) || 0
              const edgeVersion = version || 'unknown'
              const minDepth = minDepthPerVersion.get(edgeVersion) || 0
              edgeDepths.set(edgeId, { depth: globalDepth - minDepth, version: edgeVersion })
            }
          })
        })
      }
    })

    // Adjust maxPerVersion to be relative (max - min for each version)
    const relativeMaxPerVersion = new Map<string, number>()
    maxPerVersion.forEach((max, ver) => {
      const min = minDepthPerVersion.get(ver) || 0
      relativeMaxPerVersion.set(ver, max - min)
    })

    return { edges: edgeDepths, maxPerVersion: relativeMaxPerVersion }
  }, [stories, extractStoryId, extractVersion, leafStoryIds])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (highlightedNodes.has(node.id) && highlightedNodes.size === getAncestors(node.id).size) {
      setHighlightedNodes(new Set())
      setHighlightedEdges(new Map())
      setMaxDepthPerVersion(new Map())
    } else {
      const ancestors = getAncestors(node.id)
      const { edges: pathEdges, maxPerVersion } = getPathEdgesWithDepth(node.id, ancestors)
      setHighlightedNodes(ancestors)
      setHighlightedEdges(pathEdges)
      setMaxDepthPerVersion(maxPerVersion)
    }
  }, [getAncestors, getPathEdgesWithDepth, highlightedNodes])

  const openStoryModal = useCallback((nodeId: string, status: StoryStatus) => {
    const storyId = extractStoryId(nodeId)
    const version = extractVersion(nodeId)
    const story = stories.find(s => s.id === storyId && (!version || s.target_version === version))
    if (story) {
      setSelectedStory(story)
      setSelectedStatus(status)
      setModalOpen(true)
    }
  }, [stories, extractStoryId, extractVersion])

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    // Only open modal for story nodes, not version headers
    if (node.type === 'story') {
      openStoryModal(node.id, node.data?.status as StoryStatus || 'pending')
    }
  }, [openStoryModal])

  const onPaneClick = useCallback(() => {
    setHighlightedNodes(new Set())
    setHighlightedEdges(new Map())
    setMaxDepthPerVersion(new Map())
  }, [])

  // Depth-based colors for highlighted edges (25-color rainbow gradient)
  const depthColors = [
    '#facc15', // 0 - yellow
    '#eab308', // 1 - yellow-600
    '#ca8a04', // 2 - yellow-700
    '#fbbf24', // 3 - amber-400
    '#f59e0b', // 4 - amber-500
    '#f97316', // 5 - orange
    '#ea580c', // 6 - orange-600
    '#c2410c', // 7 - orange-700
    '#ef4444', // 8 - red
    '#dc2626', // 9 - red-600
    '#b91c1c', // 10 - red-700
    '#f43f5e', // 11 - rose
    '#e11d48', // 12 - rose-600
    '#ec4899', // 13 - pink
    '#db2777', // 14 - pink-600
    '#c026d3', // 15 - fuchsia
    '#a855f7', // 16 - purple
    '#9333ea', // 17 - purple-600
    '#7c3aed', // 18 - violet
    '#6366f1', // 19 - indigo
    '#4f46e5', // 20 - indigo-600
    '#3b82f6', // 21 - blue
    '#2563eb', // 22 - blue-600
    '#0ea5e9', // 23 - sky
    '#06b6d4', // 24 - cyan
  ]

  // Linear interpolation to spread colors evenly across full spectrum per version
  // Colors go from cyan (selected/leaves) -> yellow (roots)
  const getDepthColor = (depth: number, version: string) => {
    const maxDepth = maxDepthPerVersion.get(version) || 0
    if (maxDepth === 0) return depthColors[depthColors.length - 1]
    // Map depth to index: 0 -> 0, maxDepth -> 24
    const index = Math.round(depth * 24 / maxDepth)
    // Reverse: selected=cyan (end), roots=yellow (start)
    return depthColors[depthColors.length - 1 - index]
  }

  // Apply highlighting styles to edges
  const defaultEdgeColor = 'var(--graph-edge-default)'
  const hasHighlighting = highlightedEdges.size > 0

  // Build node position map for edge length calculation
  const nodePositions = new Map(nodes.map(n => [n.id, n.position]))

  // Calculate edge length (distance between source and target nodes)
  const getEdgeLength = (edge: Edge): number => {
    const sourcePos = nodePositions.get(edge.source)
    const targetPos = nodePositions.get(edge.target)
    if (!sourcePos || !targetPos) return 0
    const dx = targetPos.x - sourcePos.x
    const dy = targetPos.y - sourcePos.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  // Filter out cross-version edges if showExternalDeps is false
  const filteredEdges = showExternalDeps ? edges : edges.filter(edge => !edge.data?.crossVersion)

  const styledEdges: Edge[] = filteredEdges.map(edge => {
    const isHighlighted = highlightedEdges.has(edge.id)
    const edgeInfo = highlightedEdges.get(edge.id)
    const depth = edgeInfo?.depth ?? 0
    const version = edgeInfo?.version ?? ''
    const length = getEdgeLength(edge)
    return {
      ...edge,
      style: {
        ...edge.style,
        strokeWidth: isHighlighted ? 4 : 2,
        stroke: isHighlighted ? getDepthColor(depth, version) : (edge.style?.stroke || defaultEdgeColor),
        opacity: hasHighlighting && !isHighlighted ? 0 : 1,
      },
      // Shorter visual edges on top (higher z-index for shorter length)
      zIndex: isHighlighted ? Math.round(10000 - length) : 0,
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
        onInfoClick: node.type === 'story' ? () => openStoryModal(node.id, node.data?.status as StoryStatus || 'pending') : undefined,
      },
      style: {
        ...node.style,
        opacity: hasHighlighting && !isHighlighted ? 0.3 : 1,
      },
      zIndex: isHighlighted ? 20000 : (hasHighlighting ? -1 : 0), // above all edges (max 10000)
    }
  })

  // Get list of custom layout names (filter out any empty/undefined keys)
  const customLayoutNames = Object.keys(layoutData.customLayouts || {}).filter(name => name && name !== 'undefined')

  // Determine if we're in auto-layout mode (no manual positioning allowed)
  const isAutoLayout = layoutData.active === 'horizontal' || layoutData.active === 'vertical' || layoutData.active === 'horizontal-compact' || layoutData.active === 'vertical-compact'

  // When using CSS-based fullscreen, track it separately from native fullscreen
  const isPseudoFullscreen = isFullscreen && !fullscreenSupported

  return (
    <>
      <div className={cn(
        "w-full relative",
        isPseudoFullscreen
          ? "fixed inset-0 z-[9999] h-screen bg-background"
          : "h-[calc(100vh-2rem)]"
      )}>
        {/* Initial loading overlay */}
        {(!mounted || loading) && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading graph...</p>
            </div>
          </div>
        )}

        {/* Version Selector - Left (desktop only) */}
        {versions.length >= 1 && (
          <div className="absolute top-4 left-4 z-10 hidden lg:block">
            <Select
              value={selectedVersion}
              onValueChange={(v) => {
                setIsVersionLoading(true)
                setSelectedVersion(v)
              }}
              disabled={isVersionLoading || isLayoutLoading}
            >
              <SelectTrigger className="w-[180px] h-9 bg-background">
                {isVersionLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading...</span>
                  </div>
                ) : (
                  <SelectValue placeholder="All versions">
                    {selectedVersion === 'all' ? 'All versions' : (() => {
                      const meta = versionProgress.find(v => v.version === selectedVersion)
                      return meta?.shortTitle ? `${selectedVersion} - ${meta.shortTitle}` : selectedVersion
                    })()}
                  </SelectValue>
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All versions</SelectItem>
                {versions.map(version => {
                  const meta = versionProgress.find(v => v.version === version)
                  const label = meta?.shortTitle ? `${version} - ${meta.shortTitle}` : version
                  return (
                    <SelectItem key={version} value={version}>
                      {label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Layout Controls - Right */}
        {/* Desktop: full controls */}
        <div className="absolute top-4 right-4 z-10 hidden lg:flex items-center gap-2">
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
            className={cn("h-9 gap-2", showDeadEnds && "border-accent")}
            onClick={toggleDeadEnds}
            title="Show dead-end nodes"
          >
            <div className={cn("w-2 h-2 rounded-full", showDeadEnds ? "bg-accent" : "bg-muted-foreground")} />
            <span className="text-xs">Dead ends</span>
          </Button>

          {/* External deps toggle */}
          <Button
            variant="outline"
            size="sm"
            className={cn("h-9 gap-2", showExternalDeps && "bg-amber-500/20 border-amber-500")}
            onClick={toggleExternalDeps}
            title="Show cross-version dependency lines"
          >
            <div className={cn("w-2 h-2 rounded-full", showExternalDeps ? "bg-amber-500" : "bg-muted-foreground")} />
            <span className="text-xs">External</span>
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

        {/* Mobile: dropdown menu */}
        <div className="absolute top-4 right-4 z-10 lg:hidden">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 bg-background"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          {mobileMenuOpen && (
            <div className="absolute top-12 right-0 w-64 bg-background border rounded-lg shadow-lg p-3 space-y-3">
              {/* Version selector (mobile) */}
              {versions.length >= 1 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Version</label>
                  <Select
                    value={selectedVersion}
                    onValueChange={(v) => {
                      setIsVersionLoading(true)
                      setSelectedVersion(v)
                    }}
                    disabled={isVersionLoading || isLayoutLoading}
                  >
                    <SelectTrigger className="w-full h-9 bg-background">
                      {isVersionLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Loading...</span>
                        </div>
                      ) : (
                        <SelectValue placeholder="All versions">
                          {selectedVersion === 'all' ? 'All versions' : (() => {
                            const meta = versionProgress.find(v => v.version === selectedVersion)
                            return meta?.shortTitle ? `${selectedVersion} - ${meta.shortTitle}` : selectedVersion
                          })()}
                        </SelectValue>
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All versions</SelectItem>
                      {versions.map(version => {
                        const meta = versionProgress.find(v => v.version === version)
                        const label = meta?.shortTitle ? `${version} - ${meta.shortTitle}` : version
                        return (
                          <SelectItem key={version} value={version}>
                            {label}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {versions.length >= 1 && <div className="border-t" />}

              {/* Layout selector */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Layout</label>
                <Select
                  value={layoutData.active}
                  onValueChange={(v) => {
                    handleLayoutChange(v)
                    if (v !== '__create__') setMobileMenuOpen(false)
                  }}
                  disabled={isVersionLoading || isLayoutLoading}
                >
                  <SelectTrigger className="w-full h-9 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horizontal">Horizontal</SelectItem>
                    <SelectItem value="horizontal-compact">Horizontal Compact</SelectItem>
                    <SelectItem value="vertical">Vertical</SelectItem>
                    <SelectItem value="vertical-compact">Vertical Compact</SelectItem>
                    {customLayoutNames.length > 0 && <div className="border-t my-1" />}
                    {customLayoutNames.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                    <div className="border-t my-1" />
                    <SelectItem value="__create__">Create view...</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("w-full justify-start gap-2", showDeadEnds && "border-accent")}
                  onClick={toggleDeadEnds}
                >
                  <div className={cn("w-2 h-2 rounded-full", showDeadEnds ? "bg-accent" : "bg-muted-foreground")} />
                  Dead ends
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("w-full justify-start gap-2", showExternalDeps && "bg-amber-500/20 border-amber-500")}
                  onClick={toggleExternalDeps}
                >
                  <div className={cn("w-2 h-2 rounded-full", showExternalDeps ? "bg-amber-500" : "bg-muted-foreground")} />
                  External deps
                </Button>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={handleSetDefault}
                  disabled={layoutData.active === layoutData.defaultLayout}
                >
                  <Star className={cn("h-3 w-3", layoutData.active === layoutData.defaultLayout && "fill-yellow-500 text-yellow-500")} />
                  Default
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={handleFullscreen}
                >
                  {isFullscreen ? <Minimize className="h-3 w-3" /> : <Maximize className="h-3 w-3" />}
                  {isFullscreen ? 'Exit' : 'Full'}
                </Button>
              </div>
            </div>
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
          zoomOnDoubleClick={false}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          minZoom={0.1}
          maxZoom={2}
          style={{ background: 'var(--graph-bg)' }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--graph-dots)"
          />
          <Controls showInteractive={!isAutoLayout} />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === 'version') return 'var(--graph-node-version)'
              const status = node.data?.status as string
              switch (status) {
                case 'merged': return '#22c55e'
                case 'passed': return '#eab308'
                case 'in_progress': return 'var(--graph-node-in-progress)'
                case 'skipped': return '#a855f7'
                case 'blocked': return '#ef4444'
                default: return 'var(--graph-node-default)'
              }
            }}
            maskColor="var(--graph-minimap-mask)"
            style={{ background: 'var(--graph-minimap-bg)' }}
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
            setMaxDepthPerVersion(new Map())
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
