'use client'

import { useState } from 'react'
import { useTaskContext, type Task } from './task-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Loader2, CheckCircle, XCircle, Clock, Sparkles, Wand2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

function getTaskIcon(type: Task['type']) {
  switch (type) {
    case 'refine': return Sparkles
    case 'generate': return Wand2
    case 'story-edit': return Pencil
  }
}

function getTaskLabel(type: Task['type']) {
  switch (type) {
    case 'refine': return 'Refine'
    case 'generate': return 'Generate'
    case 'story-edit': return 'Story Edit'
  }
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

export function TaskIndicator() {
  const { activeTasks, recentTasks, setSelectedTask } = useTaskContext()
  const [open, setOpen] = useState(false)

  const hasActive = activeTasks.length > 0
  const runningTask = activeTasks.find(t => t.status === 'running')
  const queuedCount = activeTasks.filter(t => t.status === 'queued').length

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2",
            hasActive && "border-primary cyber-dark:border-accent"
          )}
        >
          {hasActive ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="hidden sm:inline">
                {runningTask ? getTaskLabel(runningTask.type) : 'Tasks'}
                {queuedCount > 0 && ` +${queuedCount}`}
              </span>
            </>
          ) : (
            <>
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Tasks</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {activeTasks.length > 0 && (
          <>
            <DropdownMenuLabel>Running</DropdownMenuLabel>
            {activeTasks.map(task => {
              const Icon = getTaskIcon(task.type)
              return (
                <DropdownMenuItem
                  key={task.id}
                  className="flex items-center gap-2"
                >
                  {task.status === 'running' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary cyber-dark:text-accent" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{getTaskLabel(task.type)}</span>
                  <span className="text-xs text-muted-foreground">{task.version}</span>
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuLabel>Recent</DropdownMenuLabel>
        {recentTasks.length === 0 ? (
          <DropdownMenuItem disabled>No recent tasks</DropdownMenuItem>
        ) : (
          recentTasks.map(task => {
            const Icon = getTaskIcon(task.type)
            return (
              <DropdownMenuItem
                key={task.id}
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => {
                  setSelectedTask(task)
                  setOpen(false)
                }}
              >
                {task.status === 'complete' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <Icon className="h-4 w-4" />
                <span className="flex-1 truncate">{getTaskLabel(task.type)}</span>
                <span className="text-xs text-muted-foreground">
                  {formatTime(task.completedAt || task.createdAt)}
                </span>
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
