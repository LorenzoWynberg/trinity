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
import { Input } from '@/components/ui/input'
import { Loader2, Sparkles, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
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

type RefineModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: string
  initialTask?: Task | null
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
      const data = await api.prd.editRefinement({
        storyId: id,
        title: ref.title,
        currentDescription: ref.suggested_description,
        currentAcceptance: ref.suggested_acceptance,
        userFeedback: editPrompt,
        tags: ref.tags,
        depends_on: ref.depends_on,
        allRefinements: refinements
      })

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
      const data = await api.prd.applyRefinements(version, toApply)
      setAppliedCount(data.applied)
      setStep('complete')
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
                    Claude is reviewing all pending stories. You&apos;ll be notified when it&apos;s done.
                  </p>
                  <p className="text-xs text-muted-foreground mt-4">
                    You can close this modal - we&apos;ll notify you when complete.
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
