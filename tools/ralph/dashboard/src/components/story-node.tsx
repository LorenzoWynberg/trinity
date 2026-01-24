'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type StoryNodeData = {
  label: string
  title: string
  status: string
  phase: number
  epic: number
  onInfoClick?: (e: React.MouseEvent) => void
}

const statusColors: Record<string, string> = {
  pending: 'bg-zinc-100 border-zinc-400 dark:bg-zinc-800 dark:border-zinc-600',
  in_progress: 'bg-blue-100 border-blue-500 dark:bg-blue-950 dark:border-blue-500',
  passed: 'bg-yellow-100 border-yellow-500 dark:bg-yellow-950 dark:border-yellow-500',
  merged: 'bg-green-100 border-green-500 dark:bg-green-950 dark:border-green-500',
  skipped: 'bg-purple-100 border-purple-500 dark:bg-purple-950 dark:border-purple-500',
  blocked: 'bg-red-100 border-red-500 dark:bg-red-950 dark:border-red-500',
}

const statusDots: Record<string, string> = {
  pending: 'bg-zinc-500 dark:bg-zinc-400',
  in_progress: 'bg-blue-500 dark:bg-blue-400',
  passed: 'bg-yellow-500 dark:bg-yellow-400',
  merged: 'bg-green-500 dark:bg-green-400',
  skipped: 'bg-purple-500 dark:bg-purple-400',
  blocked: 'bg-red-500 dark:bg-red-400',
}

export const StoryNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as StoryNodeData
  const colorClass = statusColors[nodeData.status] || statusColors.pending
  const dotClass = statusDots[nodeData.status] || statusDots.pending

  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <div
        className={cn(
          'px-3 py-2 rounded-lg border-2 w-[160px] cursor-pointer transition-all',
          colorClass,
          selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className={cn('w-2 h-2 rounded-full shrink-0', dotClass)} />
          <span className="font-mono text-xs font-medium truncate flex-1 text-zinc-800 dark:text-zinc-100">{nodeData.label}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              nodeData.onInfoClick?.(e)
            }}
            className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
          >
            <Info className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100" />
          </button>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">{nodeData.title}</p>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
    </>
  )
})

StoryNode.displayName = 'StoryNode'
