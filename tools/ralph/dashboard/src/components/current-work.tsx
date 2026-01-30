import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { State, Story } from '@/lib/types'
import { GitBranch, Clock, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

interface CurrentWorkProps {
  state: State | null
  story: Story | undefined
  lastCompletedStory?: Story | undefined
}

export function CurrentWork({ state, story, lastCompletedStory }: CurrentWorkProps) {
  if (!state?.current_story) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground">No story in progress</p>
          {state?.last_completed && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">Last completed:</span>
              <Link
                href={`/stories/${state.last_completed}`}
                className="font-mono text-primary hover:underline"
              >
                {state.last_completed}
              </Link>
              {lastCompletedStory && (
                <span className="text-muted-foreground truncate max-w-[200px]">
                  — {lastCompletedStory.title}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const statusColor: Record<string, string> = {
    idle: 'bg-gray-500',
    running: 'bg-blue-500',
    paused: 'bg-yellow-500',
    waiting_gate: 'bg-orange-500',
    blocked: 'bg-red-500'
  }
  const currentColor = statusColor[state.status] || 'bg-gray-500'

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Current Work</CardTitle>
        <Badge className={currentColor}>{state.status.replace('_', ' ')}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="font-mono text-sm text-muted-foreground">{state.current_story}</div>
          <div className="font-medium">{story?.title || 'Unknown story'}</div>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {state.branch && (
            <div className="flex items-center gap-1">
              <GitBranch className="h-4 w-4" />
              <span className="font-mono">{state.branch}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>Attempt {state.attempts}</span>
          </div>
        </div>

        {state.error && (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
            {state.error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
