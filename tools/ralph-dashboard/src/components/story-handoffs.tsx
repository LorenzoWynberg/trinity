'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  User,
  ArrowRight,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { useHandoffs } from '@/lib/query'
import { cn } from '@/lib/utils'

const AGENTS = ['analyst', 'implementer', 'reviewer', 'refactorer', 'documenter'] as const

interface StoryHandoffsProps {
  storyId: string
}

export function StoryHandoffs({ storyId }: StoryHandoffsProps) {
  const { data: handoffState, isLoading } = useHandoffs(storyId)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" />
            Agent Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  if (!handoffState || handoffState.handoffs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" />
            Agent Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">No agent activity yet</div>
        </CardContent>
      </Card>
    )
  }

  const { currentAgent, phase, handoffs } = handoffState

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <User className="h-4 w-4" />
          Agent Pipeline
          {phase && (
            <Badge variant="outline" className="ml-2 font-normal">
              {phase}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pipeline visualization */}
        <div className="flex items-center justify-between">
          {AGENTS.map((agent, i) => {
            const isActive = currentAgent === agent
            const isDone = handoffs.some(
              (h) => h.from_agent === agent && h.status === 'accepted'
            )
            const wasRejected = handoffs.some(
              (h) => h.to_agent === agent && h.status === 'rejected'
            )

            return (
              <div key={agent} className="flex items-center">
                <div
                  className={cn(
                    'flex flex-col items-center p-2 rounded-lg border-2 transition-all',
                    isActive && 'border-blue-500 bg-blue-50 dark:bg-blue-950 cyber-dark:bg-blue-950',
                    isDone && !isActive && 'border-green-500 bg-green-50 dark:bg-green-950 cyber-dark:bg-green-950',
                    wasRejected && !isActive && !isDone && 'border-orange-500',
                    !isActive && !isDone && !wasRejected && 'border-muted'
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
                      isActive && 'bg-blue-500 text-white',
                      isDone && !isActive && 'bg-green-500 text-white',
                      !isActive && !isDone && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isDone && !isActive ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      agent[0].toUpperCase()
                    )}
                  </div>
                  <span className="text-xs mt-1 capitalize">{agent}</span>
                  {isActive && (
                    <span className="text-xs text-blue-500 animate-pulse">Working</span>
                  )}
                </div>
                {i < AGENTS.length - 1 && (
                  <ArrowRight className="h-3 w-3 mx-1 text-muted-foreground" />
                )}
              </div>
            )
          })}
        </div>

        {/* Handoff history */}
        <div className="border-t pt-4">
          <div className="text-sm font-medium mb-2">Handoff History</div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {handoffs.map((h) => {
              const isExpanded = expandedId === h.id
              const hasPayload = h.payload && Object.keys(h.payload).length > 0

              return (
                <div
                  key={h.id}
                  className={cn(
                    'text-xs rounded border',
                    h.status === 'rejected'
                      ? 'bg-orange-50 dark:bg-orange-950 cyber-dark:bg-orange-950 border-orange-200 dark:border-orange-800 cyber-dark:border-orange-800'
                      : 'bg-muted/50 border-transparent'
                  )}
                >
                  <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-2">
                      <span className="capitalize font-medium">{h.from_agent}</span>
                      {h.status === 'rejected' ? (
                        <RotateCcw className="h-3 w-3 text-orange-500" />
                      ) : (
                        <ArrowRight className="h-3 w-3" />
                      )}
                      <span className="capitalize font-medium">{h.to_agent}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          h.status === 'accepted'
                            ? 'default'
                            : h.status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className="text-xs"
                      >
                        {h.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                        {h.status === 'rejected' && <AlertCircle className="h-3 w-3 mr-1" />}
                        {h.status === 'accepted' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {h.status}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(h.created_at).toLocaleTimeString()}
                      </span>
                      {(hasPayload || h.rejection_reason) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => setExpandedId(isExpanded ? null : h.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-2 pb-2 space-y-2">
                      {h.rejection_reason && (
                        <div className="bg-orange-100 dark:bg-orange-900 p-2 rounded text-orange-800 dark:text-orange-200">
                          <span className="font-medium">Rejection reason:</span>{' '}
                          {h.rejection_reason}
                        </div>
                      )}
                      {hasPayload && (
                        <div className="bg-muted p-2 rounded">
                          <div className="font-medium mb-1">Payload:</div>
                          <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(h.payload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
