'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ExternalLink, GitBranch, CheckCircle2, Circle, Pencil, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import type { Story, StoryStatus } from '@/lib/types'
import { useTaskContext } from '@/components/task-provider'

const statusConfig: Record<StoryStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-500' },
  in_progress: { label: 'In Progress', className: 'bg-blue-500' },
  passed: { label: 'Passed', className: 'bg-yellow-500' },
  merged: { label: 'Merged', className: 'bg-green-500' },
  skipped: { label: 'Skipped', className: 'bg-purple-500' },
  blocked: { label: 'Blocked', className: 'bg-red-500' },
}

type StoryModalProps = {
  story: Story | null
  status: StoryStatus
  open: boolean
  onOpenChange: (open: boolean) => void
  version?: string
  startInEditMode?: boolean
}

export function StoryModal({ story, status, open, onOpenChange, version, startInEditMode = false }: StoryModalProps) {
  const [editMode, setEditMode] = useState(startInEditMode)
  const [requestedChanges, setRequestedChanges] = useState('')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { createTask, isTaskRunning } = useTaskContext()

  const isRunning = isTaskRunning('story-edit')

  if (!story) return null

  const config = statusConfig[status]
  const branchName = `feat/story-${story.phase}.${story.epic}.${story.story_number}`
  const storyVersion = version || story.target_version || 'v0.1'

  const resetEdit = () => {
    setEditMode(startInEditMode)
    setRequestedChanges('')
    setError(null)
  }

  const handleAnalyze = async () => {
    if (!requestedChanges.trim()) return
    setStarting(true)
    setError(null)

    try {
      await createTask('story-edit', storyVersion, {
        storyId: story.id,
        requestedChanges
      })
      setRequestedChanges('')
      onOpenChange(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setStarting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetEdit(); onOpenChange(o) }}>
      <DialogContent className="md:!max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="font-mono">{story.id}</DialogTitle>
            <Badge className={config.className}>{config.label}</Badge>
            {!editMode && status !== 'merged' && (
              <Button variant="ghost" size="sm" onClick={() => setEditMode(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {!editMode && (
            <div>
              <h3 className="font-medium cyber-dark:text-secondary-foreground">{story.title}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <span>{story.phase_name ? `${String(story.phase).padStart(2, '0')}. ${story.phase_name}` : `Phase ${story.phase}`}</span>
                <span className="cyber-dark:text-accent">·</span>
                <span>{story.epic_name ? `${String(story.epic).padStart(2, '0')}. ${story.epic_name}` : `Epic ${story.epic}`}</span>
                <span className="cyber-dark:text-accent">·</span>
                <span>{storyVersion}</span>
              </div>
              <div className="border-b border-border mt-3" />
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Edit mode */}
          {editMode && (
            <div className="space-y-4 py-2">
              <div>
                <h4 className="text-sm font-medium mb-1">{story.title}</h4>
                <p className="text-xs text-muted-foreground">Describe changes for {story.id}</p>
              </div>
              {isRunning ? (
                <p className="text-sm text-muted-foreground">
                  A story edit task is already running. You'll be notified when it completes.
                </p>
              ) : (
                <>
                  <Textarea
                    placeholder="What changes do you want to make to this story?&#10;&#10;Example: Add specific validation rules, split into smaller tasks, clarify acceptance criteria..."
                    value={requestedChanges}
                    onChange={e => setRequestedChanges(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    This runs in the background — you'll get a notification when it's done.
                  </p>
                </>
              )}
            </div>
          )}

          {/* View mode content */}
          {!editMode && (
            <>
              {story.intent && (
                <div>
                  <h4 className="text-sm font-medium mb-1 cyber-dark:text-foreground">Intent</h4>
                  <p className="text-sm text-muted-foreground cyber-dark:text-muted-foreground">{story.intent}</p>
                </div>
              )}

              {story.description && (
                <>
                  <div className="border-b border-border" />
                  <div>
                    <h4 className="text-sm font-medium mb-1 cyber-dark:text-foreground">Description</h4>
                    <p className="text-sm text-muted-foreground cyber-dark:text-muted-foreground">{story.description}</p>
                  </div>
                </>
              )}

              <div className="border-b border-border" />
              <div>
                <h4 className="text-sm font-medium mb-2 cyber-dark:text-foreground">Acceptance Criteria</h4>
                <ul className="space-y-1 cyber-dark:text-muted-foreground">
                  {story.acceptance.map((ac, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      {story.merged ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      )}
                      <span>{ac}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {story.depends_on && story.depends_on.length > 0 && (
                <>
                  <div className="border-b border-border" />
                  <div>
                    <h4 className="text-sm font-medium mb-1 cyber-dark:text-foreground">Dependencies</h4>
                    <div className="flex flex-wrap gap-1">
                      {story.depends_on.map(dep => (
                        <Badge key={dep} variant="outline" className="font-mono text-xs">
                          {dep}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="border-b border-border" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GitBranch className="h-4 w-4 cyber-dark:text-accent" />
                <code className="text-xs">{branchName}</code>
              </div>

              {(story.pr_url || story.merge_commit) && (
                <div className="flex items-center gap-4 text-sm">
                  {story.pr_url && (
                    <a
                      href={story.pr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      PR #{story.pr_url.split('/').pop()}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {story.merge_commit && (
                    <a
                      href={`https://github.com/trinity-ai-labs/trinity/commit/${story.merge_commit}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <code className="text-xs">{story.merge_commit.slice(0, 8)}</code>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <Link href={`/stories/${story.id}`}>
                  <Button variant="outline" size="sm">
                    View Full Details
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Footer with action buttons */}
        {editMode && (
          <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { resetEdit(); onOpenChange(false) }}>Cancel</Button>
            <Button onClick={handleAnalyze} disabled={starting || isRunning || !requestedChanges.trim()}>
              <Pencil className="h-4 w-4" />
              {starting ? 'Starting...' : 'Analyze'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
