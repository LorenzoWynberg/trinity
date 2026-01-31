'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Loader2, Sparkles, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useTaskContext, type Task, type TaskContext } from '@/components/task-provider'

type StoryEditTarget = {
  suggested_description?: string
  suggested_acceptance?: string[]
  suggested_intent?: string
}

type RelatedUpdate = {
  id: string
  title?: string
  reason: string
  suggested_description?: string
  suggested_acceptance?: string[]
}

type StoryEditModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: string
  initialTask?: Task | null
  storyId?: string
}

export function StoryEditModal({ open, onOpenChange, version, initialTask, storyId: initialStoryId }: StoryEditModalProps) {
  const [step, setStep] = useState<'edit' | 'review' | 'complete'>('edit')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storyId, setStoryId] = useState(initialStoryId || '')
  const [requestedChanges, setRequestedChanges] = useState('')
  const [currentStory, setCurrentStory] = useState<any>(null)
  const [target, setTarget] = useState<StoryEditTarget | null>(null)
  const [relatedUpdates, setRelatedUpdates] = useState<RelatedUpdate[]>([])
  const [summary, setSummary] = useState('')
  const [applyTarget, setApplyTarget] = useState(true)
  const [selectedRelatedIds, setSelectedRelatedIds] = useState<Set<string>>(new Set())
  const [appliedCount, setAppliedCount] = useState(0)
  const { createTask, isTaskRunning } = useTaskContext()

  const taskRunning = isTaskRunning('story-edit')

  useEffect(() => {
    if (initialTask?.result && open) {
      const result = initialTask.result
      setStoryId(result.storyId || '')
      setCurrentStory(result.currentStory || null)
      setTarget(result.target || null)
      setRelatedUpdates(result.related_updates || [])
      setSummary(result.summary || '')
      setApplyTarget(true)
      setSelectedRelatedIds(new Set((result.related_updates || []).map((r: RelatedUpdate) => r.id)))
      setStep('review')
    }
  }, [initialTask, open])

  useEffect(() => {
    if (open && initialStoryId) {
      setStoryId(initialStoryId)
    }
  }, [open, initialStoryId])

  const reset = () => {
    setStep('edit')
    setLoading(false)
    setError(null)
    setStoryId(initialStoryId || '')
    setRequestedChanges('')
    setCurrentStory(null)
    setTarget(null)
    setRelatedUpdates([])
    setSummary('')
    setApplyTarget(true)
    setSelectedRelatedIds(new Set())
    setAppliedCount(0)
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const handleStartTask = async () => {
    if (!storyId.trim() || !requestedChanges.trim()) return
    setLoading(true)
    setError(null)

    try {
      const context: TaskContext = {
        returnPath: '/stories',
        step: 'review'
      }
      await createTask('story-edit', version, { storyId, requestedChanges }, context)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    setLoading(true)
    setError(null)

    const updates: any[] = []

    if (applyTarget && target) {
      updates.push({
        id: storyId,
        suggested_description: target.suggested_description,
        suggested_acceptance: target.suggested_acceptance,
        suggested_intent: target.suggested_intent
      })
    }

    relatedUpdates
      .filter(r => selectedRelatedIds.has(r.id))
      .forEach(r => {
        updates.push({
          id: r.id,
          suggested_description: r.suggested_description,
          suggested_acceptance: r.suggested_acceptance
        })
      })

    if (updates.length === 0) {
      setError('No updates selected')
      setLoading(false)
      return
    }

    try {
      const data = await api.prd.applyStoryUpdates(version, updates)
      setAppliedCount(data.applied)
      setStep('complete')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleRelatedId = (id: string) => {
    setSelectedRelatedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalSelected = (applyTarget ? 1 : 0) + selectedRelatedIds.size

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o) }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Edit Story ({version})
          </DialogTitle>
          <DialogDescription className="cyber-dark:text-secondary-foreground">
            {step === 'edit' && 'Describe the changes you want to make'}
            {step === 'review' && 'Review and apply suggested changes'}
            {step === 'complete' && 'Changes applied successfully'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2">
          {['edit', 'review', 'complete'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                step === s ? "bg-primary text-primary-foreground cyber-dark:bg-accent cyber-dark:text-accent-foreground" :
                  (step === 'complete' || (step === 'review' && i === 0))
                    ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
              )}>
                {(step === 'complete' || (step === 'review' && i === 0)) ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              {i < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-center gap-2 text-sm mb-4">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {step === 'edit' && (
            <div className="space-y-4">
              {taskRunning ? (
                <div className="text-center py-8">
                  <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
                  <p className="text-lg font-medium mb-2">Analyzing story...</p>
                  <p className="text-muted-foreground text-sm">
                    Claude is analyzing your requested changes. You&apos;ll be notified when it&apos;s done.
                  </p>
                  <p className="text-xs text-muted-foreground mt-4">
                    You can close this modal - we&apos;ll notify you when complete.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Story ID</label>
                    <Input
                      placeholder="e.g., 1.2.3"
                      value={storyId}
                      onChange={e => setStoryId(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Requested Changes</label>
                    <Textarea
                      placeholder="Describe the changes you want...&#10;&#10;Example: Add error handling for network failures and show a retry button"
                      value={requestedChanges}
                      onChange={e => setRequestedChanges(e.target.value)}
                      rows={6}
                      className="text-base"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Claude will analyze your changes and check if related stories need updates for consistency.
                  </p>
                </>
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {summary && <p className="text-sm text-muted-foreground">{summary}</p>}

              {currentStory && target && (
                <div
                  className={cn(
                    "p-3 rounded-md border transition-all cursor-pointer hover:border-primary",
                    applyTarget && "ring-2 ring-primary"
                  )}
                  onClick={() => setApplyTarget(!applyTarget)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-mono font-medium">{storyId}</span>
                      <span className="text-xs text-muted-foreground ml-2">— {currentStory.title}</span>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center",
                      applyTarget ? "bg-primary border-primary" : "border-muted-foreground"
                    )}>
                      {applyTarget && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  </div>

                  {target.suggested_intent && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-muted-foreground">Intent:</p>
                      <p className="text-xs">{target.suggested_intent}</p>
                    </div>
                  )}

                  {target.suggested_description && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-muted-foreground">Description:</p>
                      <p className="text-xs">{target.suggested_description}</p>
                    </div>
                  )}

                  {target.suggested_acceptance && target.suggested_acceptance.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Acceptance Criteria:</p>
                      <ul className="list-disc list-inside">
                        {target.suggested_acceptance.map((a, i) => (
                          <li key={i} className="text-xs">{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {relatedUpdates.length > 0 && (
                <>
                  <p className="text-sm font-medium mt-4">Related Stories ({relatedUpdates.length} may need updates):</p>
                  <div className="space-y-3">
                    {relatedUpdates.map(update => (
                      <div
                        key={update.id}
                        className={cn(
                          "p-3 rounded-md border transition-all bg-amber-500/10 border-amber-500/30",
                          "cursor-pointer hover:border-amber-500",
                          selectedRelatedIds.has(update.id) && "ring-2 ring-primary"
                        )}
                        onClick={() => toggleRelatedId(update.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-mono font-medium">{update.id}</span>
                            {update.title && <span className="text-xs text-muted-foreground ml-2">— {update.title}</span>}
                          </div>
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center",
                            selectedRelatedIds.has(update.id) ? "bg-primary border-primary" : "border-muted-foreground"
                          )}>
                            {selectedRelatedIds.has(update.id) && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground mb-2">Reason: {update.reason}</p>

                        {update.suggested_description && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-muted-foreground">Description:</p>
                            <p className="text-xs">{update.suggested_description}</p>
                          </div>
                        )}

                        {update.suggested_acceptance && update.suggested_acceptance.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Acceptance Criteria:</p>
                            <ul className="list-disc list-inside">
                              {update.suggested_acceptance.map((a, i) => (
                                <li key={i} className="text-xs">{a}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!target && relatedUpdates.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-lg font-medium">No changes suggested</p>
                  <p className="text-muted-foreground">The story appears to be clear as is.</p>
                </div>
              )}
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">Done!</p>
              <p className="text-muted-foreground">Applied {appliedCount} updates to {version}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step === 'edit' && !taskRunning && (
            <Button onClick={handleStartTask} disabled={loading || !storyId.trim() || !requestedChanges.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Analyze Changes
            </Button>
          )}
          {step === 'edit' && taskRunning && (
            <Button variant="outline" onClick={handleClose}>Close</Button>
          )}
          {step === 'review' && (target || relatedUpdates.length > 0) && (
            <>
              {loading && (
                <p className="text-xs text-muted-foreground mr-auto">
                  Applying changes to PRD...
                </p>
              )}
              <Button variant="outline" onClick={() => setStep('edit')} disabled={loading}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={handleApply} disabled={loading || totalSelected === 0}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Apply {totalSelected} Updates
              </Button>
            </>
          )}
          {(step === 'complete' || (step === 'review' && !target && relatedUpdates.length === 0)) && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
