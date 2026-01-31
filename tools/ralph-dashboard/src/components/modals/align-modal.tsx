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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Target, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useTaskContext, type Task, type TaskContext } from '@/components/task-provider'
import type { Phase, Epic } from '@/lib/types'

type AlignScope = 'project' | 'version' | 'phase' | 'epic'

type Gap = {
  description: string
  priority: 'high' | 'medium' | 'low'
  suggested_stories: {
    title: string
    intent: string
    acceptance: string[]
    phase: number
    epic: number
  }[]
}

type Misalignment = {
  story_id: string
  title: string
  issue: string
  suggestion: 'remove' | 'modify' | 'keep'
}

type Modification = {
  story_id: string
  current_title: string
  suggested_title?: string
  suggested_intent?: string
  suggested_acceptance?: string[]
  reason: string
}

type NewStory = {
  title: string
  intent: string
  acceptance: string[]
  phase: number
  epic: number
  priority: 'high' | 'medium' | 'low'
  gap_reference?: string
}

type AlignResult = {
  alignment_score: number
  summary: string
  gaps: Gap[]
  misalignments: Misalignment[]
  modifications: Modification[]
  new_stories: NewStory[]
  scope: string
  scopeId?: string
  scopeDescription: string
  vision: string
  analyzedCount: number
}

type AlignModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: string
  versions?: string[]
  phases?: Phase[]
  epics?: Epic[]
  initialTask?: Task | null
}

export function AlignModal({ open, onOpenChange, version, versions = [], phases = [], epics = [], initialTask }: AlignModalProps) {
  const [step, setStep] = useState<'input' | 'analyze' | 'review' | 'preview' | 'complete'>('input')
  const [loading, setLoading] = useState(false)
  const [refineLoading, setRefineLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Input state
  const [selectedVersion, setSelectedVersion] = useState(version)
  const [scope, setScope] = useState<AlignScope>('project')
  const [selectedPhase, setSelectedPhase] = useState<string>('')
  const [selectedEpic, setSelectedEpic] = useState<string>('')
  const [vision, setVision] = useState('')
  const [additionalInput, setAdditionalInput] = useState('')

  // Reset selectedVersion when version prop changes
  useEffect(() => {
    setSelectedVersion(version)
  }, [version])

  // Result state
  const [result, setResult] = useState<AlignResult | null>(null)

  // Selection state for preview
  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set())
  const [selectedNew, setSelectedNew] = useState<Set<number>>(new Set())
  const [selectedRemovals, setSelectedRemovals] = useState<Set<string>>(new Set())

  // Applied counts
  const [appliedCounts, setAppliedCounts] = useState({ applied: 0, added: 0, removed: 0 })

  const { createTask, isTaskRunning } = useTaskContext()
  const taskRunning = isTaskRunning('align')

  // Handle initial task result
  useEffect(() => {
    if (initialTask?.result && open) {
      setResult(initialTask.result)
      setVision(initialTask.result.vision || '')
      setScope(initialTask.result.scope || 'version')
      if (initialTask.result.scopeId) {
        if (initialTask.result.scope === 'phase') {
          setSelectedPhase(initialTask.result.scopeId)
        } else if (initialTask.result.scope === 'epic') {
          setSelectedEpic(initialTask.result.scopeId)
        }
      }
      setStep('review')
      // Pre-select all suggestions
      preselectAll(initialTask.result)
    }
  }, [initialTask, open])

  const preselectAll = (r: AlignResult) => {
    setSelectedMods(new Set(r.modifications?.map(m => m.story_id) || []))
    setSelectedNew(new Set(r.new_stories?.map((_, i) => i) || []))
    setSelectedRemovals(new Set(
      r.misalignments?.filter(m => m.suggestion === 'remove').map(m => m.story_id) || []
    ))
  }

  const reset = () => {
    setStep('input')
    setLoading(false)
    setRefineLoading(false)
    setError(null)
    setSelectedVersion(version)
    setScope('project')
    setSelectedPhase('')
    setSelectedEpic('')
    setVision('')
    setAdditionalInput('')
    setResult(null)
    setSelectedMods(new Set())
    setSelectedNew(new Set())
    setSelectedRemovals(new Set())
    setAppliedCounts({ applied: 0, added: 0, removed: 0 })
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const getScopeId = (): string | undefined => {
    if (scope === 'phase') return selectedPhase || undefined
    if (scope === 'epic') return selectedEpic || undefined
    return undefined
  }

  const getEffectiveVersion = () => scope === 'project' ? 'all' : selectedVersion

  const handleStartTask = async () => {
    if (!vision.trim()) return
    setLoading(true)
    setError(null)

    try {
      const context: TaskContext = {
        returnPath: '/stories',
        step: 'review'
      }
      await createTask('align', getEffectiveVersion(), {
        scope,
        scopeId: getScopeId(),
        vision
      }, context)
      setStep('analyze')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRefine = async () => {
    if (!additionalInput.trim() || !result) return
    setRefineLoading(true)
    setError(null)

    try {
      const refined = await api.prd.refineAlign({
        version: getEffectiveVersion(),
        previousAnalysis: result,
        additionalInput,
        scope,
        scopeId: getScopeId()
      })
      setResult({
        ...refined,
        vision: result.vision
      })
      setAdditionalInput('')
      preselectAll(refined)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRefineLoading(false)
    }
  }

  const handleApply = async () => {
    if (!result) return
    setLoading(true)
    setError(null)

    try {
      const modifications = result.modifications?.filter(m => selectedMods.has(m.story_id)) || []
      const newStories = result.new_stories?.filter((_, i) => selectedNew.has(i)) || []
      const removals = Array.from(selectedRemovals)

      const data = await api.prd.applyAlignChanges(getEffectiveVersion(), {
        modifications,
        newStories,
        removals
      })

      setAppliedCounts(data)
      setStep('complete')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleMod = (id: string) => {
    setSelectedMods(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleNew = (idx: number) => {
    setSelectedNew(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const toggleRemoval = (id: string) => {
    setSelectedRemovals(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500'
    if (score >= 60) return 'text-yellow-500'
    if (score >= 40) return 'text-orange-500'
    return 'text-red-500'
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-600 border-red-500/30'
      case 'medium': return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30'
      case 'low': return 'bg-green-500/20 text-green-600 border-green-500/30'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const filteredEpics = scope === 'epic' && selectedPhase
    ? epics.filter(e => e.phase === parseInt(selectedPhase, 10))
    : epics

  const totalChanges = selectedMods.size + selectedNew.size + selectedRemovals.size

  const stepLabels = ['input', 'analyze', 'review', 'preview', 'complete']
  const currentStepIdx = stepLabels.indexOf(step)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o) }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Align PRD
          </DialogTitle>
          <DialogDescription className="cyber-dark:text-secondary-foreground">
            {step === 'input' && 'Describe your vision to check PRD alignment'}
            {step === 'analyze' && 'Analyzing alignment with your vision...'}
            {step === 'review' && 'Review alignment analysis and refine if needed'}
            {step === 'preview' && 'Select which changes to apply'}
            {step === 'complete' && 'Changes applied successfully'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2">
          {stepLabels.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                currentStepIdx === i ? "bg-primary text-primary-foreground cyber-dark:bg-accent cyber-dark:text-accent-foreground" :
                  currentStepIdx > i ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
              )}>
                {currentStepIdx > i ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              {i < stepLabels.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
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

          {/* Step 1: Input */}
          {step === 'input' && (
            <div className="space-y-4">
              {/* Scope selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Scope</label>
                <Select value={scope} onValueChange={(v) => setScope(v as AlignScope)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project">Whole Project</SelectItem>
                    <SelectItem value="version">Specific Version</SelectItem>
                    <SelectItem value="phase">Specific Phase</SelectItem>
                    <SelectItem value="epic">Specific Epic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Version selection - only show when not whole project */}
              {scope !== 'project' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Version</label>
                  <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select version" />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map(v => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Phase selector */}
              {(scope === 'phase' || scope === 'epic') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phase</label>
                  <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select phase" />
                    </SelectTrigger>
                    <SelectContent>
                      {phases.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          Phase {p.id}: {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Epic selector */}
              {scope === 'epic' && selectedPhase && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Epic</label>
                  <Select value={selectedEpic} onValueChange={setSelectedEpic}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select epic" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredEpics.map(e => (
                        <SelectItem key={`${e.phase}.${e.id}`} value={`${e.phase}.${e.id}`}>
                          Epic {e.id}: {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Vision input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Vision</label>
                <Textarea
                  placeholder="Describe what you want to build and your goals...&#10;&#10;Example: I want to build a modern task management app that focuses on team collaboration. Key features should include real-time updates, easy task assignment, and progress tracking. The app should be simple to use without overwhelming users with options."
                  value={vision}
                  onChange={e => setVision(e.target.value)}
                  rows={8}
                  className="text-base"
                />
                <p className="text-xs text-muted-foreground">
                  Be specific about your goals, priorities, and what success looks like. Claude will analyze how well your current stories align with this vision.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Analyze (loading) */}
          {step === 'analyze' && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
              <p className="text-lg font-medium mb-2">Analyzing alignment...</p>
              <p className="text-muted-foreground text-sm">
                Claude is comparing your stories against your vision. You&apos;ll be notified when it&apos;s done.
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                You can close this modal - we&apos;ll notify you when complete.
              </p>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 'review' && result && (
            <div className="space-y-6">
              {/* Score and summary */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <div className="text-center">
                  <div className={cn("text-4xl font-bold", getScoreColor(result.alignment_score))}>
                    {result.alignment_score}
                  </div>
                  <div className="text-xs text-muted-foreground">/ 100</div>
                </div>
                <div className="flex-1">
                  <p className="font-medium mb-1">Alignment Score</p>
                  <p className="text-sm text-muted-foreground">{result.summary}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Analyzed {result.analyzedCount} stories in {result.scopeDescription}
                  </p>
                </div>
              </div>

              {/* Gaps */}
              {result.gaps?.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Gaps ({result.gaps.length})</h3>
                  <div className="space-y-2">
                    {result.gaps.map((gap, i) => (
                      <div key={i} className="p-3 rounded-md border bg-amber-500/10 border-amber-500/30">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn("text-xs px-2 py-0.5 rounded border", getPriorityColor(gap.priority))}>
                            {gap.priority}
                          </span>
                          <span className="font-medium text-sm">{gap.description}</span>
                        </div>
                        {gap.suggested_stories?.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {gap.suggested_stories.length} suggested {gap.suggested_stories.length === 1 ? 'story' : 'stories'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Misalignments */}
              {result.misalignments?.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Misalignments ({result.misalignments.length})</h3>
                  <div className="space-y-2">
                    {result.misalignments.map((m, i) => (
                      <div key={i} className="p-3 rounded-md border bg-red-500/10 border-red-500/30">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs">{m.story_id}</span>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded",
                            m.suggestion === 'remove' ? 'bg-red-500/20 text-red-600' :
                              m.suggestion === 'modify' ? 'bg-yellow-500/20 text-yellow-600' :
                                'bg-green-500/20 text-green-600'
                          )}>
                            {m.suggestion}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{m.issue}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modifications summary */}
              {result.modifications?.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Suggested Modifications ({result.modifications.length})</h3>
                  <p className="text-sm text-muted-foreground">
                    {result.modifications.length} existing {result.modifications.length === 1 ? 'story' : 'stories'} can be improved
                  </p>
                </div>
              )}

              {/* New stories summary */}
              {result.new_stories?.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Suggested New Stories ({result.new_stories.length})</h3>
                  <p className="text-sm text-muted-foreground">
                    {result.new_stories.length} new {result.new_stories.length === 1 ? 'story' : 'stories'} to fill gaps
                  </p>
                </div>
              )}

              {/* Refine input */}
              <div className="space-y-2 pt-4 border-t">
                <label className="text-sm font-medium">Refine Analysis</label>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add more context or ask Claude to focus on specific areas..."
                    value={additionalInput}
                    onChange={e => setAdditionalInput(e.target.value)}
                    rows={3}
                    className="flex-1"
                    disabled={refineLoading}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefine}
                    disabled={refineLoading || !additionalInput.trim()}
                  >
                    {refineLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Refine Analysis
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Preview */}
          {step === 'preview' && result && (
            <div className="space-y-6">
              {/* Modifications */}
              {result.modifications?.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Modifications</h3>
                  <div className="space-y-2">
                    {result.modifications.map((mod, i) => (
                      <div
                        key={i}
                        className={cn(
                          "p-3 rounded-md border cursor-pointer transition-all",
                          selectedMods.has(mod.story_id) ? "ring-2 ring-primary border-primary" : "hover:border-primary"
                        )}
                        onClick={() => toggleMod(mod.story_id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs">{mod.story_id}</span>
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center",
                            selectedMods.has(mod.story_id) ? "bg-primary border-primary" : "border-muted-foreground"
                          )}>
                            {selectedMods.has(mod.story_id) && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                          </div>
                        </div>
                        <p className="text-sm">
                          <span className="line-through text-muted-foreground">{mod.current_title}</span>
                          {mod.suggested_title && mod.suggested_title !== mod.current_title && (
                            <span className="ml-2">&rarr; {mod.suggested_title}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{mod.reason}</p>
                        {mod.suggested_acceptance && mod.suggested_acceptance.length > 0 && (
                          <ul className="list-disc list-inside mt-2">
                            {mod.suggested_acceptance.map((a, j) => (
                              <li key={j} className="text-xs">{a}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New stories */}
              {result.new_stories?.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">New Stories</h3>
                  <div className="space-y-2">
                    {result.new_stories.map((story, i) => (
                      <div
                        key={i}
                        className={cn(
                          "p-3 rounded-md border cursor-pointer transition-all",
                          selectedNew.has(i) ? "ring-2 ring-primary border-primary" : "hover:border-primary"
                        )}
                        onClick={() => toggleNew(i)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              Phase {story.phase}, Epic {story.epic}
                            </span>
                            <span className={cn("text-xs px-2 py-0.5 rounded border", getPriorityColor(story.priority))}>
                              {story.priority}
                            </span>
                          </div>
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center",
                            selectedNew.has(i) ? "bg-primary border-primary" : "border-muted-foreground"
                          )}>
                            {selectedNew.has(i) && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                          </div>
                        </div>
                        <p className="font-medium text-sm">{story.title}</p>
                        {story.intent && <p className="text-xs text-muted-foreground mt-1">{story.intent}</p>}
                        {story.acceptance?.length > 0 && (
                          <ul className="list-disc list-inside mt-2">
                            {story.acceptance.map((a, j) => (
                              <li key={j} className="text-xs">{a}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Removals */}
              {result.misalignments?.filter(m => m.suggestion === 'remove').length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Stories to Remove</h3>
                  <div className="space-y-2">
                    {result.misalignments.filter(m => m.suggestion === 'remove').map((m, i) => (
                      <div
                        key={i}
                        className={cn(
                          "p-3 rounded-md border cursor-pointer transition-all bg-red-500/5",
                          selectedRemovals.has(m.story_id) ? "ring-2 ring-destructive border-destructive" : "hover:border-destructive"
                        )}
                        onClick={() => toggleRemoval(m.story_id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs">{m.story_id}</span>
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center",
                            selectedRemovals.has(m.story_id) ? "bg-destructive border-destructive" : "border-muted-foreground"
                          )}>
                            {selectedRemovals.has(m.story_id) && <CheckCircle className="h-3 w-3 text-destructive-foreground" />}
                          </div>
                        </div>
                        <p className="font-medium text-sm">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{m.issue}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {totalChanges === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No changes selected
                </div>
              )}
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">Done!</p>
              <div className="text-muted-foreground space-y-1">
                {appliedCounts.applied > 0 && <p>Modified {appliedCounts.applied} stories</p>}
                {appliedCounts.added > 0 && <p>Added {appliedCounts.added} new stories</p>}
                {appliedCounts.removed > 0 && <p>Removed {appliedCounts.removed} stories</p>}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step === 'input' && (
            <Button
              onClick={handleStartTask}
              disabled={loading || taskRunning || !vision.trim() || (scope === 'phase' && !selectedPhase) || (scope === 'epic' && (!selectedPhase || !selectedEpic))}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Target className="h-4 w-4 mr-2" />}
              Analyze Alignment
            </Button>
          )}
          {step === 'analyze' && (
            <Button variant="outline" onClick={handleClose}>Close</Button>
          )}
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={() => setStep('input')} disabled={refineLoading}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep('preview')} disabled={refineLoading}>
                Preview Changes <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              {loading && (
                <p className="text-xs text-muted-foreground mr-auto">
                  Applying changes...
                </p>
              )}
              <Button variant="outline" onClick={() => setStep('review')} disabled={loading}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={handleApply} disabled={loading || totalChanges === 0}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Apply {totalChanges} Changes
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
