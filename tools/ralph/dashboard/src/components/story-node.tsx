'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'

type StoryNodeData = {
  label: string
  title: string
  status: string
  phase: number
  epic: number
}

const statusColors: Record<string, string> = {
  pending: 'bg-gray-500/20 border-gray-500',
  in_progress: 'bg-blue-500/20 border-blue-500',
  passed: 'bg-yellow-500/20 border-yellow-500',
  merged: 'bg-green-500/20 border-green-500',
  skipped: 'bg-purple-500/20 border-purple-500',
  blocked: 'bg-red-500/20 border-red-500',
}

const statusDots: Record<string, string> = {
  pending: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  passed: 'bg-yellow-500',
  merged: 'bg-green-500',
  skipped: 'bg-purple-500',
  blocked: 'bg-red-500',
}

export const StoryNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as StoryNodeData
  const colorClass = statusColors[nodeData.status] || statusColors.pending
  const dotClass = statusDots[nodeData.status] || statusDots.pending

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div
        className={cn(
          'px-3 py-2 rounded-lg border-2 min-w-[140px] max-w-[200px] cursor-pointer transition-all',
          colorClass,
          selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className={cn('w-2 h-2 rounded-full', dotClass)} />
          <span className="font-mono text-xs font-medium">{nodeData.label}</span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{nodeData.title}</p>
        <div className="text-[10px] text-muted-foreground mt-1">
          Phase {nodeData.phase} · Epic {nodeData.epic}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </>
  )
})

StoryNode.displayName = 'StoryNode'
