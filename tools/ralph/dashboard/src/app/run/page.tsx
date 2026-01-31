'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, GitBranch, CheckCircle, Clock } from 'lucide-react'
import { RunModal } from '@/components/run-modal'
import { useVersions, useExecutionStatus } from '@/lib/query'

export default function RunPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [userSelectedVersion, _setUserSelectedVersion] = useState<string | null>(null)

  // Fetch versions
  const { data: versionsData } = useVersions()
  const versions = useMemo(() => versionsData?.versions || [], [versionsData?.versions])

  // Use user selection or default to first version
  const selectedVersion = userSelectedVersion ?? versions[0] ?? 'v0.1'

  // Fetch execution status (polls only when running)
  const { data: status } = useExecutionStatus(selectedVersion)

  const statusColor = {
    idle: 'bg-gray-500',
    running: 'bg-blue-500',
    paused: 'bg-yellow-500',
    waiting_gate: 'bg-purple-500',
    blocked: 'bg-red-500'
  }[status?.state?.status || 'idle'] || 'bg-gray-500'

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Run</h1>
          <p className="text-muted-foreground">Execute the development loop</p>
        </div>
        <Badge className={statusColor}>
          {status?.state?.status?.replace('_', ' ') || 'idle'}
        </Badge>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Start Run</CardTitle>
            <CardDescription>Execute stories from the PRD</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setModalOpen(true)} size="lg" className="w-full">
              <Play className="h-5 w-5 mr-2" />
              Run Story
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {status?.progress && (
              <>
                <div className="flex justify-between text-sm">
                  <span>Stories</span>
                  <span>{status.progress.merged} / {status.progress.total} merged</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${status.progress.percentage}%` }}
                  />
                </div>
              </>
            )}

            {status?.state?.current_story && (
              <div className="pt-2 border-t">
                <div className="text-sm text-muted-foreground">Current Story</div>
                <div className="font-mono">{status.state.current_story}</div>
                {status.state.branch && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <GitBranch className="h-3 w-3" />
                    {status.state.branch}
                  </div>
                )}
              </div>
            )}

            {status?.state?.last_completed && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Last: {status.state.last_completed}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Story Queue */}
      {status?.scoredStories && status.scoredStories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Story Queue</CardTitle>
            <CardDescription>Ranked by smart selection algorithm</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {status.scoredStories.slice(0, 8).map((scored, i) => (
                <div
                  key={scored.storyId}
                  className={`flex items-center justify-between p-2 rounded ${i === 0 ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' : 'bg-muted/50'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium w-6">{i + 1}.</span>
                    <span className="font-mono text-sm">{scored.storyId}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span title="Tree Proximity">Tree: {scored.proximity.toFixed(1)}</span>
                    <span title="Tag Overlap">Tags: {scored.tagOverlap.toFixed(2)}</span>
                    <span title="Blocker Value">Blocks: {scored.blockerValue}</span>
                    <Badge variant="outline">{scored.score.toFixed(2)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Story Preview */}
      {status?.nextStory && !status?.state?.current_story && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Next Up
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-sm text-muted-foreground">{status.nextStory.id}</div>
            <div className="font-medium text-lg">{status.nextStory.title}</div>
            {status.nextStory.intent && (
              <p className="text-sm text-muted-foreground mt-2">{status.nextStory.intent}</p>
            )}
            {status.nextStory.acceptance && status.nextStory.acceptance.length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-medium mb-1">Acceptance Criteria:</div>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {status.nextStory.acceptance.slice(0, 3).map((ac, i) => (
                    <li key={i}>{ac}</li>
                  ))}
                  {status.nextStory.acceptance.length > 3 && (
                    <li className="text-muted-foreground">+{status.nextStory.acceptance.length - 3} more</li>
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Run Modal */}
      <RunModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialVersion={selectedVersion}
      />
    </div>
  )
}
