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
  direction?: 'horizontal' | 'vertical'
  isDeadEnd?: boolean
  showDeadEnd?: boolean
}

const statusColors: Record<string, string> = {
  pending: 'bg-zinc-100 border-zinc-400 dark:bg-zinc-800 dark:border-zinc-600 cyber-dark:bg-cyan-900/80 cyber-dark:border-cyan-400 cyber-light:bg-purple-100 cyber-light:border-pink-400/50',
  in_progress: 'bg-blue-100 border-blue-500 dark:bg-blue-950 dark:border-blue-500 cyber-dark:bg-cyan-800/90 cyber-dark:border-cyan-300 cyber-light:bg-cyan-100 cyber-light:border-cyan-500',
  passed: 'bg-yellow-100 border-yellow-500 dark:bg-yellow-950 dark:border-yellow-500 cyber-dark:bg-cyan-900/70 cyber-dark:border-yellow-400 cyber-light:bg-yellow-100 cyber-light:border-yellow-500',
  merged: 'bg-green-100 border-green-500 dark:bg-green-950 dark:border-green-500 cyber-dark:bg-cyan-900/60 cyber-dark:border-green-400 cyber-light:bg-green-100 cyber-light:border-green-500',
  skipped: 'bg-purple-100 border-purple-500 dark:bg-purple-950 dark:border-purple-500 cyber-dark:bg-cyan-900/50 cyber-dark:border-purple-400 cyber-light:bg-purple-100 cyber-light:border-purple-500',
  blocked: 'bg-red-100 border-red-500 dark:bg-red-950 dark:border-red-500 cyber-dark:bg-cyan-900/70 cyber-dark:border-red-400 cyber-light:bg-red-100 cyber-light:border-red-500',
}

const statusDots: Record<string, string> = {
  pending: 'bg-zinc-500 dark:bg-zinc-400 cyber-dark:bg-purple-400',
  in_progress: 'bg-blue-500 dark:bg-blue-400 cyber-dark:bg-purple-300',
  passed: 'bg-yellow-500 dark:bg-yellow-400 cyber-dark:bg-yellow-400',
  merged: 'bg-green-500 dark:bg-green-400 cyber-dark:bg-green-400',
  skipped: 'bg-purple-500 dark:bg-purple-400 cyber-dark:bg-purple-400',
  blocked: 'bg-red-500 dark:bg-red-400 cyber-dark:bg-red-400',
}

export const StoryNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as StoryNodeData
  const colorClass = statusColors[nodeData.status] || statusColors.pending
  const dotClass = statusDots[nodeData.status] || statusDots.pending
  const isVertical = nodeData.direction === 'vertical'

  return (
    <>
      <Handle
        type="target"
        position={isVertical ? Position.Top : Position.Left}
        className="!bg-muted-foreground"
      />
      <div
        className={cn(
          'rounded-lg border-2 w-[160px] cursor-pointer transition-all overflow-hidden',
          colorClass,
          selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
        )}
      >
        <div className="px-3 py-2">
          <div className={cn('flex items-center gap-2 mb-1', isVertical && 'justify-center')}>
            <div className={cn('w-2 h-2 rounded-full shrink-0', dotClass)} />
            <span className={cn('font-mono text-xs font-medium truncate text-zinc-800 dark:text-zinc-100 cyber-dark:text-purple-100', !isVertical && 'flex-1')}>{nodeData.label}</span>
          </div>
          <p className={cn('text-xs text-zinc-600 dark:text-zinc-400 cyber-dark:text-purple-200 line-clamp-2', isVertical && 'text-center')}>{nodeData.title}</p>
        </div>
        {nodeData.showDeadEnd && (
          <div className="h-1.5 bg-orange-500" />
        )}
      </div>
      <Handle
        type="source"
        position={isVertical ? Position.Bottom : Position.Right}
        className="!bg-muted-foreground"
      />
    </>
  )
})

StoryNode.displayName = 'StoryNode'
