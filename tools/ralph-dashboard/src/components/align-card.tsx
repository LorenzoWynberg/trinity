'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Target, Loader2 } from 'lucide-react'
import { AlignModal } from '@/components/modals/align-modal'
import { useTaskContext } from '@/components/task-provider'
import type { Phase, Epic } from '@/lib/types'

interface AlignCardProps {
  version: string
  versions: string[]
  phases?: Phase[]
  epics?: Epic[]
}

export function AlignCard({ version, versions, phases = [], epics = [] }: AlignCardProps) {
  const [alignOpen, setAlignOpen] = useState(false)
  const { isTaskRunning } = useTaskContext()
  const alignRunning = isTaskRunning('align')

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Align PRD
          </CardTitle>
          <CardDescription>
            Check if your PRD aligns with your vision
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Describe what you want to build and Claude will analyze your stories to find gaps, misalignments, and suggest improvements.
          </p>
          <Button
            onClick={() => setAlignOpen(true)}
            disabled={alignRunning}
            className="w-full"
          >
            {alignRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Target className="h-4 w-4 mr-2" />
                Start Alignment Check
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <AlignModal
        open={alignOpen}
        onOpenChange={setAlignOpen}
        version={version}
        versions={versions}
        phases={phases}
        epics={epics}
      />
    </>
  )
}
