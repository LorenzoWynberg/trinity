'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import { StoryModal } from '@/components/story-modal'
import type { Story, StoryStatus } from '@/lib/types'

type StoryEditButtonProps = {
  story: Story
  status: StoryStatus
  version?: string
}

export function StoryEditButton({ story, status, version }: StoryEditButtonProps) {
  const [open, setOpen] = useState(false)

  if (status === 'merged') return null

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4 mr-2" />
        Edit Story
      </Button>
      <StoryModal
        story={story}
        status={status}
        open={open}
        onOpenChange={setOpen}
        version={version}
      />
    </>
  )
}
