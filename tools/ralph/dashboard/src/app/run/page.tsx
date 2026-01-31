'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Play, GitBranch, CheckCircle, Clock, User, ArrowRight, RotateCcw } from 'lucide-react'
import { RunModal } from '@/components/run-modal'
import { useVersions, useExecutionStatus, useHandoffs } from '@/lib/query'

export default function RunPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<string>('v0.1')

  // Fetch versions
  const { data: versionsData } = useVersions()
  const versions = useMemo(() => versionsData?.versions || [], [versionsData?.versions])

  // Set default version when versions load
  useMemo(() => {
    if (versions.length > 0 && !versions.includes(selectedVersion)) {
      setSelectedVersion(versions[0])
    }
  }, [versions, selectedVersion])

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
        <div className="flex items-center gap-4">
          <Select value={selectedVersion} onValueChange={setSelectedVersion}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Version" />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge className={statusColor}>
            {status?.state?.status?.replace('_', ' ') || 'idle'}
          </Badge>
        </div>
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
              {['analyst', 'implementer', 'reviewer', 'refactorer', 'documenter'].map((agent, i) => {
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
                      ${isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 cyber-dark:bg-blue-950' : ''}
                      ${isDone && !isActive ? 'border-green-500 bg-green-50 dark:bg-green-950 cyber-dark:bg-green-950' : ''}
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
                    {i < 4 && (
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
                        ${h.status === 'rejected' ? 'bg-orange-50 dark:bg-orange-950 cyber-dark:bg-orange-950' : 'bg-muted/50'}
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
            <CardTitle className="text-lg">Story Queue ({status.scoredStories.length} ready)</CardTitle>
            <CardDescription>Ranked by smart selection - dependencies met, ready to run</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {status.scoredStories.slice(0, 10).map((scored, i) => (
                <div
                  key={scored.storyId}
                  className={`p-3 rounded ${i === 0 ? 'bg-green-50 dark:bg-green-950 cyber-dark:bg-green-950 border border-green-200 dark:border-green-800 cyber-dark:border-green-800' : 'bg-muted/50'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold w-6 text-muted-foreground">{i + 1}.</span>
                      <div>
                        <span className="font-mono text-sm">{scored.storyId}</span>
                        {scored.title && (
                          <p className="text-sm text-muted-foreground truncate max-w-md">{scored.title}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="ml-2">{scored.score.toFixed(2)}</Badge>
                  </div>
                  {scored.blockerValue > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                      <span className="text-green-600 dark:text-green-400 cyber-dark:text-green-400 font-medium">
                        Unblocks {scored.blockerValue} {scored.blockerValue === 1 ? 'story' : 'stories'}
                      </span>
                      {scored.wouldUnblock && scored.wouldUnblock.length > 0 && (
                        <span className="text-muted-foreground">
                          ({scored.wouldUnblock.slice(0, 3).join(', ')}{scored.wouldUnblock.length > 3 ? '...' : ''})
                        </span>
                      )}
                    </div>
                  )}
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
