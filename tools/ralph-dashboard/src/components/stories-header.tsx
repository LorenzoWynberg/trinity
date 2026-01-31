'use client'

import { useState, useEffect, useRef } from 'react'
import { SplitButton } from '@/components/ui/split-button'
import { Sparkles, Wand2, Loader2, Target } from 'lucide-react'
import { RefineStoriesModal, GenerateStoriesModal, StoryEditModal, AlignModal } from '@/components/prd-tools-modals'
import { useTaskContext, type Task } from '@/components/task-provider'
import { useTaskStore } from '@/lib/task-store'
import type { Phase, Epic } from '@/lib/types'

type StoriesHeaderProps = {
  totalStories: number
  phaseCount: number
  version: string
  versions?: string[]
  phases?: Phase[]
  epics?: Epic[]
}

export function StoriesHeader({ totalStories, phaseCount, version, versions = [], phases = [], epics = [] }: StoriesHeaderProps) {
  const [refineOpen, setRefineOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [storyEditOpen, setStoryEditOpen] = useState(false)
  const [alignOpen, setAlignOpen] = useState(false)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const { isTaskRunning } = useTaskContext()

  // Get pending tasks from store (reactive)
  const pendingTasks = useTaskStore((state) => state.pendingTasks)
  const removePendingTask = useTaskStore((state) => state.removePendingTask)

  // Track which tasks we've already processed to avoid loops
  const processedTasksRef = useRef<Set<string>>(new Set())

  // Process pending tasks when they change
  useEffect(() => {
    if (pendingTasks.length === 0) return

    // Find the first completed task we haven't processed yet
    const task = pendingTasks.find(t =>
      (t.status === 'complete' || t.status === 'failed') &&
      !processedTasksRef.current.has(t.id)
    )

    if (task) {
      processedTasksRef.current.add(task.id)
      setActiveTask(task)
      if (task.type === 'refine') {
        setRefineOpen(true)
      } else if (task.type === 'generate') {
        setGenerateOpen(true)
      } else if (task.type === 'story-edit') {
        setStoryEditOpen(true)
      } else if (task.type === 'align') {
        setAlignOpen(true)
      }
      // Remove this task from pending
      removePendingTask(task.id)
    }
  }, [pendingTasks, removePendingTask])

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

  const handleAlignOpenChange = (open: boolean) => {
    setAlignOpen(open)
    if (!open) setActiveTask(null)
  }

  const refineRunning = isTaskRunning('refine')
  const generateRunning = isTaskRunning('generate')
  const alignRunning = isTaskRunning('align')

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
            icon={alignRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
            onClick={() => setAlignOpen(true)}
            disabled={alignRunning}
          >
            {alignRunning ? 'Aligning...' : 'Align'}
          </SplitButton>
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
      <AlignModal
        open={alignOpen}
        onOpenChange={handleAlignOpenChange}
        version={version}
        versions={versions}
        phases={phases}
        epics={epics}
        initialTask={activeTask?.type === 'align' ? activeTask : undefined}
      />
    </>
  )
}
