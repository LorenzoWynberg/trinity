'use client'

import { useState } from 'react'
import { SplitButton } from '@/components/ui/split-button'
import { Sparkles, Wand2, Loader2 } from 'lucide-react'
import { RefineStoriesModal, GenerateStoriesModal } from '@/components/prd-tools-modals'
import { useTaskContext } from '@/components/task-provider'

type StoriesHeaderProps = {
  totalStories: number
  phaseCount: number
  version: string
}

export function StoriesHeader({ totalStories, phaseCount, version }: StoriesHeaderProps) {
  const [refineOpen, setRefineOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const { isTaskRunning } = useTaskContext()

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
        onOpenChange={setRefineOpen}
        version={version}
      />
      <GenerateStoriesModal
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        version={version}
      />
    </>
  )
}
