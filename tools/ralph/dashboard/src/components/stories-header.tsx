'use client'

import { useState, useEffect, useCallback } from 'react'
import { SplitButton } from '@/components/ui/split-button'
import { Sparkles, Wand2, Loader2 } from 'lucide-react'
import { RefineStoriesModal, GenerateStoriesModal, StoryEditModal } from '@/components/prd-tools-modals'
import { useTaskContext, type Task } from '@/components/task-provider'
import { useTaskStore } from '@/lib/task-store'

type StoriesHeaderProps = {
  totalStories: number
  phaseCount: number
  version: string
}

export function StoriesHeader({ totalStories, phaseCount, version }: StoriesHeaderProps) {
  const [refineOpen, setRefineOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [storyEditOpen, setStoryEditOpen] = useState(false)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const { isTaskRunning } = useTaskContext()

  const processPendingTasks = useCallback(() => {
    const { pendingTasks, removePendingTask } = useTaskStore.getState()

    if (pendingTasks.length === 0) return

    // Find the first completed task
    const task = pendingTasks.find(t =>
      t.status === 'complete' || t.status === 'failed'
    )

    if (task) {
      setActiveTask(task)
      if (task.type === 'refine') {
        setRefineOpen(true)
      } else if (task.type === 'generate') {
        setGenerateOpen(true)
      } else if (task.type === 'story-edit') {
        setStoryEditOpen(true)
      }
      // Remove this task from pending
      removePendingTask(task.id)
    }
  }, [])

  // Check for pending tasks on mount and subscribe to changes
  useEffect(() => {
    // Check immediately
    processPendingTasks()

    // Subscribe to store changes
    const unsubscribe = useTaskStore.subscribe(() => {
      processPendingTasks()
    })

    return unsubscribe
  }, [processPendingTasks])

  // Clear active task when modals close
  const handleRefineOpenChange = (open: boolean) => {
    setRefineOpen(open)
    if (!open) setActiveTask(null)
  }

  const handleGenerateOpenChange = (open: boolean) => {
    setGenerateOpen(open)
    if (!open) setActiveTask(null)
  }

  const handleStoryEditOpenChange = (open: boolean) => {
    setStoryEditOpen(open)
    if (!open) setActiveTask(null)
  }

  const refineRunning = isTaskRunning('refine')
  const generateRunning = isTaskRunning('generate')

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold cyber-light:text-pink-600 cyber-dark:text-foreground">Stories</h1>
          <p className="text-muted-foreground cyber-light:text-cyan-600 cyber-dark:text-secondary-foreground">
            {totalStories} stories across {phaseCount} phases
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SplitButton
            size="sm"
            icon={refineRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            onClick={() => setRefineOpen(true)}
            disabled={refineRunning}
          >
            {refineRunning ? 'Refining...' : 'Refine'}
          </SplitButton>
          <SplitButton
            size="sm"
            icon={generateRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            onClick={() => setGenerateOpen(true)}
            disabled={generateRunning}
          >
            {generateRunning ? 'Generating...' : 'Generate'}
          </SplitButton>
        </div>
      </div>

      <RefineStoriesModal
        open={refineOpen}
        onOpenChange={handleRefineOpenChange}
        version={version}
        initialTask={activeTask?.type === 'refine' ? activeTask : undefined}
      />
      <GenerateStoriesModal
        open={generateOpen}
        onOpenChange={handleGenerateOpenChange}
        version={version}
        initialTask={activeTask?.type === 'generate' ? activeTask : undefined}
      />
      <StoryEditModal
        open={storyEditOpen}
        onOpenChange={handleStoryEditOpenChange}
        version={version}
        initialTask={activeTask?.type === 'story-edit' ? activeTask : undefined}
      />
    </>
  )
}
