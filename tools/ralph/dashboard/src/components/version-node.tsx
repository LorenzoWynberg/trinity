'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'

type VersionNodeData = {
  label: string
  title?: string
  shortTitle?: string
  description?: string
  total: number
  merged: number
  percentage: number
  direction?: string
}

export const VersionNode = memo(({ data }: NodeProps) => {
  const nodeData = data as VersionNodeData
  const isVertical = nodeData.direction === 'vertical'

  return (
    <>
      <Handle
        type="target"
        position={isVertical ? Position.Top : Position.Left}
        className="!bg-transparent !border-0"
        style={{ visibility: 'hidden' }}
      />
      <div
        className={cn(
          'px-4 py-3 rounded-xl border-2 cursor-default',
          'bg-purple-50 border-purple-300 dark:bg-purple-950 dark:border-purple-700',
          'cyber-dark:bg-yellow-900/60 cyber-dark:border-yellow-400',
          'cyber-light:bg-white cyber-light:border-cyan-400',
          'min-w-[180px] max-w-[240px]'
        )}
      >
        <div className={cn('font-bold text-lg text-purple-800 dark:text-purple-100 cyber-dark:text-cyan-100 cyber-light:text-cyan-700', isVertical && 'text-center')}>
          {nodeData.label}
        </div>
        {nodeData.title && (
          <div className={cn('mt-1 text-sm font-medium text-purple-700 dark:text-purple-200 cyber-dark:text-fuchsia-200 cyber-light:text-pink-500', isVertical && 'text-center')}>
            {nodeData.title}
          </div>
        )}
        {nodeData.description && (
          <div className={cn('mt-1 text-xs text-purple-500 dark:text-purple-400 cyber-dark:text-fuchsia-300 cyber-light:text-cyan-600', isVertical && 'text-center')}>
            {nodeData.description}
          </div>
        )}
        <div className={cn('mt-2 text-sm text-purple-600 dark:text-purple-300 cyber-dark:text-cyan-200 cyber-light:text-cyan-600', isVertical && 'text-center')}>
          {nodeData.merged}/{nodeData.total}
        </div>
        <div className="mt-2 h-1.5 bg-purple-200 dark:bg-purple-800 cyber-dark:bg-yellow-950 cyber-light:bg-cyan-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all"
            style={{ width: `${nodeData.percentage}%` }}
          />
        </div>
      </div>
      <Handle
        type="source"
        position={isVertical ? Position.Bottom : Position.Right}
        className="!bg-transparent !border-0"
        style={{ visibility: 'hidden' }}
      />
    </>
  )
})

VersionNode.displayName = 'VersionNode'
