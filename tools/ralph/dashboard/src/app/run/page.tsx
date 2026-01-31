'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, GitBranch, CheckCircle, Clock, User, ArrowRight, RotateCcw } from 'lucide-react'
import { RunModal } from '@/components/run-modal'
import { useVersions, useExecutionStatus, useHandoffs } from '@/lib/query'

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

  // Fetch handoffs for current story
  const currentStoryId = status?.state?.current_story
  const { data: handoffState } = useHandoffs(currentStoryId)

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

      {/* Agent Pipeline */}
      {currentStoryId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Agent Pipeline
            </CardTitle>
            <CardDescription>
              {handoffState?.phase ? `Phase: ${handoffState.phase}` : 'Waiting to start'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Pipeline visualization */}
            <div className="flex items-center justify-between mb-6">
              {['analyst', 'implementer', 'reviewer', 'documenter'].map((agent, i) => {
                const isActive = handoffState?.currentAgent === agent
                const isDone = handoffState?.handoffs?.some(
                  h => h.from_agent === agent && h.status === 'accepted'
                )
                const wasRejected = handoffState?.handoffs?.some(
                  h => h.to_agent === agent && h.status === 'rejected'
                )

                return (
                  <div key={agent} className="flex items-center">
                    <div className={`
                      flex flex-col items-center p-3 rounded-lg border-2 transition-all
                      ${isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''}
                      ${isDone && !isActive ? 'border-green-500 bg-green-50 dark:bg-green-950' : ''}
                      ${wasRejected ? 'border-orange-500' : ''}
                      ${!isActive && !isDone && !wasRejected ? 'border-muted' : ''}
                    `}>
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                        ${isActive ? 'bg-blue-500 text-white' : ''}
                        ${isDone && !isActive ? 'bg-green-500 text-white' : ''}
                        ${!isActive && !isDone ? 'bg-muted text-muted-foreground' : ''}
                      `}>
                        {isDone && !isActive ? <CheckCircle className="h-5 w-5" /> : agent[0].toUpperCase()}
                      </div>
                      <span className="text-xs mt-1 capitalize">{agent}</span>
                      {isActive && (
                        <span className="text-xs text-blue-500 animate-pulse">Working...</span>
                      )}
                    </div>
                    {i < 3 && (
                      <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Handoff history */}
            {handoffState?.handoffs && handoffState.handoffs.length > 0 && (
              <div className="border-t pt-4">
                <div className="text-sm font-medium mb-2">Handoff History</div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {handoffState.handoffs.map((h) => (
                    <div
                      key={h.id}
                      className={`
                        text-xs p-2 rounded flex items-center justify-between
                        ${h.status === 'rejected' ? 'bg-orange-50 dark:bg-orange-950' : 'bg-muted/50'}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <span className="capitalize">{h.from_agent}</span>
                        {h.status === 'rejected' ? (
                          <RotateCcw className="h-3 w-3 text-orange-500" />
                        ) : (
                          <ArrowRight className="h-3 w-3" />
                        )}
                        <span className="capitalize">{h.to_agent}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={h.status === 'accepted' ? 'default' : h.status === 'rejected' ? 'destructive' : 'secondary'}>
                          {h.status}
                        </Badge>
                        <span className="text-muted-foreground">
                          {new Date(h.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
