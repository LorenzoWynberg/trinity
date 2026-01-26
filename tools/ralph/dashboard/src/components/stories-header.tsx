'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Wand2 } from 'lucide-react'
import { RefineStoriesModal, GenerateStoriesModal } from '@/components/prd-tools-modals'

type StoriesHeaderProps = {
  totalStories: number
  phaseCount: number
  version: string
}

export function StoriesHeader({ totalStories, phaseCount, version }: StoriesHeaderProps) {
  const [refineOpen, setRefineOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold cyber-light:text-pink-600 cyber-dark:text-cyan-400">Stories</h1>
          <p className="text-muted-foreground cyber-light:text-cyan-600">
            {totalStories} stories across {phaseCount} phases
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setRefineOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Refine
          </Button>
          <Button variant="outline" size="sm" onClick={() => setGenerateOpen(true)}>
            <Wand2 className="h-4 w-4 mr-2" />
            Generate
          </Button>
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
