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
import { Loader2, Sparkles, Wand2, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTaskContext, type Task, type TaskContext } from '@/components/task-provider'

type Refinement = {
  id: string
  title: string
  status: 'ok' | 'needs_work'
  issues: string[]
  suggested_description: string
  suggested_acceptance: string[]
  tags?: string[]
  depends_on?: string[]
}

type GeneratedStory = {
  title: string
  intent: string
  acceptance: string[]
  phase: number
  epic: number
  depends_on: string[]
  tags: string[]
}

// Refine Stories Modal - Full wizard with background task support
type RefineModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: string
  initialTask?: Task | null  // Resume from completed task
}

export function RefineStoriesModal({ open, onOpenChange, version, initialTask }: RefineModalProps) {
  const [step, setStep] = useState<'analyze' | 'review' | 'complete'>('analyze')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refinements, setRefinements] = useState<Refinement[]>([])
  const [summary, setSummary] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [appliedCount, setAppliedCount] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const { createTask, isTaskRunning } = useTaskContext()

  const taskRunning = isTaskRunning('refine')

  // Initialize from task results if provided
  useEffect(() => {
    if (initialTask?.result && open) {
      const result = initialTask.result
      setRefinements(result.refinements || [])
      setSummary(result.summary || '')
      const needsWork = (result.refinements || [])
        .filter((r: Refinement) => r.status === 'needs_work')
        .map((r: Refinement) => r.id)
      setSelectedIds(new Set(needsWork))
      setStep('review')
    }
  }, [initialTask, open])

  const reset = () => {
    setStep('analyze')
    setLoading(false)
    setError(null)
    setRefinements([])
    setSummary('')
    setSelectedIds(new Set())
    setAppliedCount(0)
    setEditingId(null)
    setEditPrompt('')
    setEditLoading(false)
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const handleStartTask = async () => {
    setLoading(true)
    setError(null)

    try {
      const context: TaskContext = {
        returnPath: '/stories',
        step: 'review'
      }
      await createTask('refine', version, {}, context)
      // Don't close - show "task running" state
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (ref: Refinement, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(ref.id)
    setEditPrompt('')
  }

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(null)
    setEditPrompt('')
  }

  const submitEditPrompt = async (id: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    if (!editPrompt.trim() || editLoading) return

    const ref = refinements.find(r => r.id === id)
    if (!ref) return

    setEditLoading(true)
    try {
      const res = await fetch('/api/prd/refine/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: id,
          title: ref.title,
          currentDescription: ref.suggested_description,
          currentAcceptance: ref.suggested_acceptance,
          userFeedback: editPrompt,
          tags: ref.tags,
          depends_on: ref.depends_on,
          allRefinements: refinements
        })
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setRefinements(prev => prev.map(r => {
          if (r.id === id && data.target) {
            return {
              ...r,
              suggested_description: data.target.suggested_description,
              suggested_acceptance: data.target.suggested_acceptance
            }
          }
          const relatedUpdate = (data.related_updates || []).find((u: any) => u.id === r.id)
          if (relatedUpdate) {
            return {
              ...r,
              suggested_description: relatedUpdate.suggested_description || r.suggested_description,
              suggested_acceptance: relatedUpdate.suggested_acceptance || r.suggested_acceptance,
              issues: [...r.issues, `Updated due to changes in ${id}: ${relatedUpdate.reason}`]
            }
          }
          return r
        }))
        setEditingId(null)
        setEditPrompt('')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setEditLoading(false)
    }
  }

  const handleApply = async () => {
    if (selectedIds.size === 0) return
    setLoading(true)
    setError(null)

    const toApply = refinements.filter(r => selectedIds.has(r.id))

    try {
      const res = await fetch('/api/prd/refine', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, refinements: toApply })
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setAppliedCount(data.applied)
        setStep('complete')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const needsWorkCount = refinements.filter(r => r.status === 'needs_work').length

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o) }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Refine Stories ({version})
          </DialogTitle>
          <DialogDescription className="cyber-dark:text-secondary-foreground">
            {step === 'analyze' && 'Analyze pending stories for clarity issues'}
            {step === 'review' && 'Review and select refinements to apply'}
            {step === 'complete' && 'Refinements applied successfully'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2">
          {['analyze', 'review', 'complete'].map((s, i) => (
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

          {step === 'analyze' && (
            <div className="text-center py-8">
              {taskRunning ? (
                <>
                  <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
                  <p className="text-lg font-medium mb-2">Analyzing stories...</p>
                  <p className="text-muted-foreground text-sm">
                    Claude is reviewing all pending stories. You'll be notified when it's done.
                  </p>
                  <p className="text-xs text-muted-foreground mt-4">
                    You can close this modal - we'll notify you when complete.
                  </p>
                </>
              ) : loading ? (
                <>
                  <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
                  <p className="text-lg font-medium mb-2">Starting task...</p>
                </>
              ) : (
                <>
                  <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Claude will analyze all pending stories in {version} and suggest improvements for unclear acceptance criteria.
                  </p>
                  <Button onClick={handleStartTask} disabled={loading || taskRunning} size="lg">
                    <Sparkles className="h-4 w-4" />
                    Start Analysis
                  </Button>
                </>
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{summary}</p>

              {needsWorkCount === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-lg font-medium">All stories look good!</p>
                  <p className="text-muted-foreground">No refinements needed.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium">{needsWorkCount} stories need work. Click to select/deselect:</p>
                  {refinements.filter(r => r.status === 'needs_work').map(ref => (
                    <div
                      key={ref.id}
                      className={cn(
                        "p-3 rounded-md border transition-all",
                        "bg-amber-500/10 border-amber-500/30",
                        editingId !== ref.id && "cursor-pointer hover:border-amber-500",
                        selectedIds.has(ref.id) && "ring-2 ring-primary"
                      )}
                      onClick={() => editingId !== ref.id && toggleId(ref.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-mono font-medium">{ref.id}</span>
                          {ref.title && <span className="text-xs text-muted-foreground ml-2">— {ref.title}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {editingId !== ref.id && (
                            <Button variant="ghost" size="sm" onClick={(e) => startEdit(ref, e)} title="Refine with AI">
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center",
                            selectedIds.has(ref.id) ? "bg-primary border-primary" : "border-muted-foreground"
                          )}>
                            {selectedIds.has(ref.id) && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                          </div>
                        </div>
                      </div>
                      {ref.issues.length > 0 && (
                        <p className="text-xs text-muted-foreground mb-2">Issues: {ref.issues.join(', ')}</p>
                      )}
                      {ref.suggested_description && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-muted-foreground">Description:</p>
                          <p className="text-xs">{ref.suggested_description}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Acceptance Criteria:</p>
                        <ul className="list-disc list-inside">
                          {ref.suggested_acceptance.map((a, i) => (
                            <li key={i} className="text-xs">{a}</li>
                          ))}
                        </ul>
                      </div>
                      {editingId === ref.id && (
                        <div className="mt-2 flex gap-2" onClick={e => e.stopPropagation()}>
                          <Input
                            value={editPrompt}
                            onChange={e => setEditPrompt(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && submitEditPrompt(ref.id, e)}
                            placeholder="e.g., be more specific about error handling..."
                            className="text-xs flex-1"
                            disabled={editLoading}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={(e) => submitEditPrompt(ref.id, e)}
                            disabled={editLoading || !editPrompt.trim()}
                          >
                            {editLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={(e) => cancelEdit(e)} disabled={editLoading}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">Done!</p>
              <p className="text-muted-foreground">Applied {appliedCount} refinements to {version}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step === 'analyze' && taskRunning && (
            <Button variant="outline" onClick={handleClose}>Close</Button>
          )}
          {step === 'review' && needsWorkCount > 0 && (
            <>
              {loading && (
                <p className="text-xs text-muted-foreground mr-auto">
                  Applying refinements to PRD...
                </p>
              )}
              <Button variant="outline" onClick={() => setStep('analyze')} disabled={loading}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={handleApply} disabled={loading || selectedIds.size === 0}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Apply {selectedIds.size} Refinements
              </Button>
            </>
          )}
          {(step === 'complete' || (step === 'review' && needsWorkCount === 0)) && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Story Edit Modal - Full wizard with background task support
type StoryEditModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: string
  initialTask?: Task | null
  storyId?: string  // Optional: pre-populate story to edit
}

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

  // Initialize from task results if provided
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

  // Reset storyId when modal opens with a new initialStoryId
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

    // Build updates array
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
      const res = await fetch('/api/prd/story', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, updates })
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setAppliedCount(data.applied)
        setStep('complete')
      }
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

        {/* Step indicator */}
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
                    Claude is analyzing your requested changes. You'll be notified when it's done.
                  </p>
                  <p className="text-xs text-muted-foreground mt-4">
                    You can close this modal - we'll notify you when complete.
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

              {/* Target story changes */}
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

              {/* Related story updates */}
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

// Generate Stories Modal - Full wizard with background task support
type GenerateModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: string
  initialTask?: Task | null
}

export function GenerateStoriesModal({ open, onOpenChange, version, initialTask }: GenerateModalProps) {
  const [step, setStep] = useState<'input' | 'review' | 'complete'>('input')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [stories, setStories] = useState<GeneratedStory[]>([])
  const [reasoning, setReasoning] = useState('')
  const [selectedIdxs, setSelectedIdxs] = useState<Set<number>>(new Set())
  const [addedCount, setAddedCount] = useState(0)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editStory, setEditStory] = useState<GeneratedStory | null>(null)
  const { createTask, isTaskRunning } = useTaskContext()

  const taskRunning = isTaskRunning('generate')

  // Initialize from task results if provided
  useEffect(() => {
    if (initialTask?.result && open) {
      const result = initialTask.result
      setStories(result.stories || [])
      setReasoning(result.reasoning || '')
      setSelectedIdxs(new Set((result.stories || []).map((_: any, i: number) => i)))
      setStep('review')
    }
  }, [initialTask, open])

  const reset = () => {
    setStep('input')
    setLoading(false)
    setError(null)
    setDescription('')
    setStories([])
    setReasoning('')
    setSelectedIdxs(new Set())
    setAddedCount(0)
    setEditingIdx(null)
    setEditStory(null)
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const handleStartTask = async () => {
    if (!description.trim()) return
    setLoading(true)
    setError(null)

    try {
      const context: TaskContext = {
        returnPath: '/stories',
        step: 'review'
      }
      await createTask('generate', version, { description }, context)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const startEditStory = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingIdx(idx)
    setEditStory({ ...stories[idx] })
  }

  const cancelEditStory = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingIdx(null)
    setEditStory(null)
  }

  const saveEditStory = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!editStory) return
    setStories(prev => prev.map((s, i) => i === idx ? editStory : s))
    setEditingIdx(null)
    setEditStory(null)
  }

  const updateEditStory = (field: keyof GeneratedStory, value: any) => {
    if (!editStory) return
    setEditStory({ ...editStory, [field]: value })
  }

  const handleAdd = async () => {
    if (selectedIdxs.size === 0) return
    setLoading(true)
    setError(null)

    const toAdd = stories.filter((_, i) => selectedIdxs.has(i))

    try {
      const res = await fetch('/api/prd/generate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, stories: toAdd })
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setAddedCount(data.added)
        setStep('complete')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleIdx = (idx: number) => {
    setSelectedIdxs(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o) }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Generate Stories ({version})
          </DialogTitle>
          <DialogDescription className="cyber-dark:text-secondary-foreground">
            {step === 'input' && 'Describe what you want to build'}
            {step === 'review' && 'Review and select stories to add'}
            {step === 'complete' && 'Stories added successfully'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2">
          {['input', 'review', 'complete'].map((s, i) => (
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

          {step === 'input' && (
            <div className="space-y-4">
              {taskRunning ? (
                <div className="text-center py-8">
                  <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
                  <p className="text-lg font-medium mb-2">Generating stories...</p>
                  <p className="text-muted-foreground text-sm">
                    Claude is creating stories based on your description. You'll be notified when it's done.
                  </p>
                  <p className="text-xs text-muted-foreground mt-4">
                    You can close this modal - we'll notify you when complete.
                  </p>
                </div>
              ) : (
                <>
                  <Textarea
                    placeholder="Describe what you want to build...&#10;&#10;Example: Add user authentication with OAuth support for Google and GitHub, including login/logout flows and session management"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={6}
                    className="text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    Be specific about features, behaviors, and requirements. Claude will generate properly formatted PRD stories.
                  </p>
                </>
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {reasoning && <p className="text-sm text-muted-foreground">{reasoning}</p>}

              <div className="space-y-3">
                <p className="text-sm font-medium">{stories.length} stories generated. Click to select/deselect:</p>
                {stories.map((story, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-3 rounded-md border transition-all",
                      editingIdx !== i && "cursor-pointer hover:border-primary",
                      selectedIdxs.has(i) && "ring-2 ring-primary"
                    )}
                    onClick={() => editingIdx !== i && toggleIdx(i)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      {editingIdx === i && editStory ? (
                        <Input
                          value={editStory.title}
                          onChange={e => updateEditStory('title', e.target.value)}
                          className="font-medium text-sm h-7"
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span className="font-medium">{story.title}</span>
                      )}
                      <div className="flex items-center gap-2">
                        {editingIdx === i ? (
                          <>
                            <Button variant="ghost" size="sm" onClick={(e) => cancelEditStory(e)}>
                              <X className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={(e) => saveEditStory(i, e)}>
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={(e) => startEditStory(i, e)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        <div className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center",
                          selectedIdxs.has(i) ? "bg-primary border-primary" : "border-muted-foreground"
                        )}>
                          {selectedIdxs.has(i) && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </div>
                    </div>

                    {editingIdx === i && editStory ? (
                      <div className="space-y-2" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <Input
                            value={editStory.phase}
                            onChange={e => updateEditStory('phase', parseInt(e.target.value) || 1)}
                            className="w-20 h-7 text-xs"
                            placeholder="Phase"
                            type="number"
                          />
                          <Input
                            value={editStory.epic}
                            onChange={e => updateEditStory('epic', parseInt(e.target.value) || 1)}
                            className="w-20 h-7 text-xs"
                            placeholder="Epic"
                            type="number"
                          />
                          <Input
                            value={editStory.tags?.join(', ') || ''}
                            onChange={e => updateEditStory('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                            className="flex-1 h-7 text-xs"
                            placeholder="Tags (comma-separated)"
                          />
                        </div>
                        <Input
                          value={editStory.intent || ''}
                          onChange={e => updateEditStory('intent', e.target.value)}
                          className="h-7 text-xs"
                          placeholder="Intent"
                        />
                        <Textarea
                          value={editStory.acceptance?.join('\n') || ''}
                          onChange={e => updateEditStory('acceptance', e.target.value.split('\n').filter(l => l.trim()))}
                          rows={3}
                          className="text-xs"
                          placeholder="Acceptance criteria (one per line)"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="text-xs text-muted-foreground mb-2">
                          Phase {story.phase} / Epic {story.epic}
                          {story.tags?.length > 0 && ` · ${story.tags.join(', ')}`}
                        </div>
                        {story.intent && <p className="text-sm mb-2">{story.intent}</p>}
                        <ul className="list-disc list-inside">
                          {story.acceptance?.map((a, j) => (
                            <li key={j} className="text-xs">{a}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">Done!</p>
              <p className="text-muted-foreground">Added {addedCount} stories to {version}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step === 'input' && !taskRunning && (
            <Button onClick={handleStartTask} disabled={loading || !description.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
              Generate Stories
            </Button>
          )}
          {step === 'input' && taskRunning && (
            <Button variant="outline" onClick={handleClose}>Close</Button>
          )}
          {step === 'review' && (
            <>
              {loading && (
                <p className="text-xs text-muted-foreground mr-auto">
                  Adding stories to PRD...
                </p>
              )}
              <Button variant="outline" onClick={() => setStep('input')} disabled={loading}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={handleAdd} disabled={loading || selectedIdxs.size === 0}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Add {selectedIdxs.size} Stories
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
