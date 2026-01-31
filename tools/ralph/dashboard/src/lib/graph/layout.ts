import type { Story } from '../types'
import type { LayoutDirection } from './types'
import { resolveDependency } from './dependencies'

/**
 * Calculate depth of each node (longest path from root)
 */
export function calculateDepths(stories: Story[]): Map<string, number> {
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

    // Resolve all dependencies (including phase/epic refs) to story IDs
    const resolvedDeps = story.depends_on.flatMap(dep =>
      resolveDependency(dep, stories, story.target_version).map(r => r.storyId)
    )
    const validDeps = resolvedDeps.filter(dep => storyMap.has(dep))

    if (validDeps.length === 0) {
      depths.set(id, 0)
      return 0
    }

    const maxDepDep = Math.max(...validDeps.map(dep => getDepth(dep, visited)))
    const depth = maxDepDep + 1
    depths.set(id, depth)
    return depth
  }

  stories.forEach(s => getDepth(s.id))
  return depths
}

// Layout constants
const NODE_WIDTH = 170
const NODE_HEIGHT = 70
const MAX_PER_COL = 6
const VERSION_HEADER_WIDTH = 180
const VERSION_HEADER_HEIGHT = 140
const VERSION_GAP = 100

/**
 * Calculate auto-layout positions for a single version
 * Returns positions keyed by versioned node ID: "v1.0:1.1.1"
 */
export function calculateSingleVersionPositions(
  stories: Story[],
  direction: LayoutDirection,
  offsetX: number = 0,
  offsetY: number = 0
): Record<string, { x: number; y: number }> {
  const depths = calculateDepths(stories)
  const positions: Record<string, { x: number; y: number }> = {}

  // Story ID already includes version prefix (e.g., "v0.1:1.1.1")
  const posKey = (story: Story) => story.id

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

  // Spacing varies by layout type
  const isVertical = direction === 'vertical' || direction === 'vertical-compact'
  const H_GAP = isVertical ? 80 : 60
  const V_GAP = direction === 'horizontal-compact' ? 40 : (isVertical ? 70 : 20)

  const maxDepth = Math.max(...Array.from(depths.values()), 0)

  if (direction === 'horizontal') {
    // Horizontal: all nodes in column, unlimited height
    for (let depth = 0; depth <= maxDepth; depth++) {
      const group = byDepth.get(depth) || []
      group.forEach((story, idx) => {
        positions[posKey(story)] = {
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
          positions[posKey(story)] = {
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
        positions[posKey(story)] = {
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
          positions[posKey(story)] = {
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

/**
 * Calculate auto-layout positions with version grouping
 */
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
  const isVertical = direction === 'vertical' || direction === 'vertical-compact'
  const H_GAP = isVertical ? 80 : 60
  const V_GAP = direction === 'horizontal-compact' ? 40 : (isVertical ? 70 : 20)

  if (direction === 'horizontal' || direction === 'horizontal-compact') {
    let currentX = 0

    for (const ver of sortedVersions) {
      const verStories = byVersion.get(ver) || []
      if (verStories.length === 0) continue

      // Stories start at currentX (version node will be at the END)
      const verPositions = calculateSingleVersionPositions(verStories, direction, currentX, 0)
      Object.assign(positions, verPositions)

      const posValues = Object.values(verPositions)
      const maxX = posValues.length > 0 ? Math.max(...posValues.map(p => p.x)) : currentX

      if (includeVersionHeaders) {
        // Version node at the END (right side), after all stories
        const versionX = maxX + NODE_WIDTH + H_GAP

        if (direction === 'horizontal-compact') {
          const maxColHeight = MAX_PER_COL * NODE_HEIGHT + (MAX_PER_COL - 1) * V_GAP
          const centerY = (maxColHeight - VERSION_HEADER_HEIGHT) / 2
          positions[`version:${ver}`] = { x: versionX, y: centerY }
        } else {
          // Center with leaf stories (max depth)
          const depths = calculateDepths(verStories)
          const maxDepth = Math.max(...Array.from(depths.values()), 0)
          const leafStories = verStories.filter(s => (depths.get(s.id) || 0) === maxDepth)

          if (leafStories.length > 0) {
            const leafYs = leafStories.map(s => verPositions[s.id]?.y || 0)
            const minY = Math.min(...leafYs)
            const maxY = Math.max(...leafYs)
            const centerY = (minY + maxY + NODE_HEIGHT - VERSION_HEADER_HEIGHT) / 2
            positions[`version:${ver}`] = { x: versionX, y: centerY }
          } else {
            positions[`version:${ver}`] = { x: versionX, y: 0 }
          }
        }
        currentX = versionX + VERSION_HEADER_WIDTH + VERSION_GAP
      } else {
        currentX = maxX + NODE_WIDTH + VERSION_GAP
      }
    }
  } else {
    let currentY = 0

    for (const ver of sortedVersions) {
      const verStories = byVersion.get(ver) || []
      if (verStories.length === 0) continue

      // Stories start at currentY (version node will be at the END/bottom)
      const verPositions = calculateSingleVersionPositions(verStories, direction, 0, currentY)
      Object.assign(positions, verPositions)

      const posValues = Object.values(verPositions)
      const maxY = posValues.length > 0 ? Math.max(...posValues.map(p => p.y)) : currentY

      if (includeVersionHeaders) {
        // Version node at the END (bottom), after all stories
        const versionY = maxY + NODE_HEIGHT + V_GAP
        // Left-align version header
        positions[`version:${ver}`] = { x: 0, y: versionY }
        currentY = versionY + VERSION_HEADER_HEIGHT + VERSION_GAP
      } else {
        currentY = maxY + NODE_HEIGHT + VERSION_GAP
      }
    }
  }

  return positions
}
