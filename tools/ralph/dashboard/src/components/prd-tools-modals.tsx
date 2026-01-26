'use client'

import { useState } from 'react'
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
import { Loader2, Sparkles, Wand2, CheckCircle, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type Refinement = {
  id: string
  status: 'ok' | 'needs_work'
  issues: string[]
  suggested_acceptance: string[]
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

// Refine Stories Modal - Wizard Style
type RefineModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: string
}

export function RefineStoriesModal({ open, onOpenChange, version }: RefineModalProps) {
  const [step, setStep] = useState<'analyze' | 'review' | 'complete'>('analyze')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refinements, setRefinements] = useState<Refinement[]>([])
  const [summary, setSummary] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [appliedCount, setAppliedCount] = useState(0)

  const reset = () => {
    setStep('analyze')
    setLoading(false)
    setError(null)
    setRefinements([])
    setSummary('')
    setSelectedIds(new Set())
    setAppliedCount(0)
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/prd/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version })
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setRefinements(data.refinements || [])
        setSummary(data.summary || '')
        const needsWork = (data.refinements || [])
          .filter((r: Refinement) => r.status === 'needs_work')
          .map((r: Refinement) => r.id)
        setSelectedIds(new Set(needsWork))
        setStep('review')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
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
          <DialogDescription>
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
                step === s ? "bg-primary text-primary-foreground" :
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
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Claude will analyze all pending stories in {version} and suggest improvements for unclear acceptance criteria.
              </p>
              <Button onClick={handleAnalyze} disabled={loading} size="lg">
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Start Analysis
              </Button>
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
                        "p-3 rounded-md border cursor-pointer transition-all",
                        "bg-amber-500/10 border-amber-500/30 hover:border-amber-500",
                        selectedIds.has(ref.id) && "ring-2 ring-primary"
                      )}
                      onClick={() => toggleId(ref.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-medium">{ref.id}</span>
                        <div className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center",
                          selectedIds.has(ref.id) ? "bg-primary border-primary" : "border-muted-foreground"
                        )}>
                          {selectedIds.has(ref.id) && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </div>
                      {ref.issues.length > 0 && (
                        <p className="text-xs text-muted-foreground mb-2">Issues: {ref.issues.join(', ')}</p>
                      )}
                      <ul className="list-disc list-inside">
                        {ref.suggested_acceptance.map((a, i) => (
                          <li key={i} className="text-xs">{a}</li>
                        ))}
                      </ul>
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

        <DialogFooter>
          {step === 'review' && needsWorkCount > 0 && (
            <>
              <Button variant="outline" onClick={() => setStep('analyze')}>
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

// Generate Stories Modal - Wizard Style
type GenerateModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: string
}

export function GenerateStoriesModal({ open, onOpenChange, version }: GenerateModalProps) {
  const [step, setStep] = useState<'input' | 'review' | 'complete'>('input')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [stories, setStories] = useState<GeneratedStory[]>([])
  const [reasoning, setReasoning] = useState('')
  const [selectedIdxs, setSelectedIdxs] = useState<Set<number>>(new Set())
  const [addedCount, setAddedCount] = useState(0)

  const reset = () => {
    setStep('input')
    setLoading(false)
    setError(null)
    setDescription('')
    setStories([])
    setReasoning('')
    setSelectedIdxs(new Set())
    setAddedCount(0)
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const handleGenerate = async () => {
    if (!description.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/prd/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, description })
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setStories(data.stories || [])
        setReasoning(data.reasoning || '')
        setSelectedIdxs(new Set((data.stories || []).map((_: any, i: number) => i)))
        setStep('review')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
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
          <DialogDescription>
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
                step === s ? "bg-primary text-primary-foreground" :
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
                      "p-3 rounded-md border cursor-pointer transition-all hover:border-primary",
                      selectedIdxs.has(i) && "ring-2 ring-primary"
                    )}
                    onClick={() => toggleIdx(i)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{story.title}</span>
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center",
                        selectedIdxs.has(i) ? "bg-primary border-primary" : "border-muted-foreground"
                      )}>
                        {selectedIdxs.has(i) && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </div>
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

        <DialogFooter>
          {step === 'input' && (
            <Button onClick={handleGenerate} disabled={loading || !description.trim()}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Generate Stories
            </Button>
          )}
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={() => setStep('input')}>
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
