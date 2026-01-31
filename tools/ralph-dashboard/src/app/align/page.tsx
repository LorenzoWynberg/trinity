'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Target, Loader2, CheckCircle, AlertCircle, ChevronRight, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useTaskContext, type TaskContext } from '@/components/task-provider'
import { useTaskStore } from '@/lib/task-store'
import type { Phase, Epic, PRD } from '@/lib/types'

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

export default function AlignPage() {
  const [step, setStep] = useState<'input' | 'review' | 'preview' | 'complete'>('input')
  const [loading, setLoading] = useState(false)
  const [refineLoading, setRefineLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Data state
  const [versions, setVersions] = useState<string[]>([])
  const [prdData, setPrdData] = useState<PRD | null>(null)

  // Input state
  const [selectedVersion, setSelectedVersion] = useState<string>('')
  const [scope, setScope] = useState<AlignScope>('project')
  const [selectedPhase, setSelectedPhase] = useState<string>('')
  const [selectedEpic, setSelectedEpic] = useState<string>('')
  const [vision, setVision] = useState('')
  const [additionalInput, setAdditionalInput] = useState('')

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

  // Handle completed tasks from store
  const pendingTasks = useTaskStore((state) => state.pendingTasks)
  const removePendingTask = useTaskStore((state) => state.removePendingTask)

  // Fetch versions on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const { versions: v } = await api.prd.getVersions()
        setVersions(v)
        if (v.length > 0) {
          setSelectedVersion(v[0])
        }
      } catch (e) {
        console.error('Failed to fetch versions:', e)
      }
    }
    fetchData()
  }, [])

  // Fetch PRD data when version changes (for phase/epic selectors)
  useEffect(() => {
    async function fetchPrd() {
      if (!selectedVersion) return
      try {
        const prd = await api.prd.get(selectedVersion)
        setPrdData(prd)
      } catch (e) {
        console.error('Failed to fetch PRD:', e)
      }
    }
    if (scope !== 'project') {
      fetchPrd()
    }
  }, [selectedVersion, scope])

  // Handle completed align tasks
  useEffect(() => {
    const alignTask = pendingTasks.find(t => t.type === 'align' && (t.status === 'complete' || t.status === 'failed'))
    if (alignTask) {
      if (alignTask.status === 'complete' && alignTask.result) {
        setResult(alignTask.result)
        setVision(alignTask.result.vision || '')
        setStep('review')
        preselectAll(alignTask.result)
      } else if (alignTask.status === 'failed') {
        setError(alignTask.error || 'Analysis failed')
        setStep('input')
      }
      removePendingTask(alignTask.id)
    }
  }, [pendingTasks, removePendingTask])

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

  const getEffectiveVersion = () => scope === 'project' ? 'all' : selectedVersion

  const getScopeId = (): string | undefined => {
    if (scope === 'phase') return selectedPhase || undefined
    if (scope === 'epic') return selectedEpic || undefined
    return undefined
  }

  const handleStartTask = async () => {
    if (!vision.trim()) return
    setLoading(true)
    setError(null)

    try {
      const context: TaskContext = {
        returnPath: '/align',
        step: 'review'
      }
      await createTask('align', getEffectiveVersion(), {
        scope,
        scopeId: getScopeId(),
        vision
      }, context)
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

  const phases: Phase[] = prdData?.phases || []
  const epics: Epic[] = prdData?.epics || []
  const filteredEpics = scope === 'epic' && selectedPhase
    ? epics.filter(e => e.phase === parseInt(selectedPhase, 10))
    : epics

  const totalChanges = selectedMods.size + selectedNew.size + selectedRemovals.size

  const stepLabels = ['input', 'review', 'preview', 'complete']
  const currentStepIdx = stepLabels.indexOf(step)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold cyber-light:text-pink-600 cyber-dark:text-foreground flex items-center gap-2">
            <Target className="h-6 w-6" />
            Align PRD
          </h1>
          <p className="text-muted-foreground cyber-light:text-cyan-600 cyber-dark:text-secondary-foreground">
            Check if your PRD aligns with your vision
          </p>
        </div>
        {step !== 'input' && step !== 'complete' && (
          <Button variant="outline" onClick={reset}>
            Start Over
          </Button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
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
        <span className="ml-4 text-sm text-muted-foreground">
          {step === 'input' && 'Describe your vision'}
          {step === 'review' && 'Review analysis'}
          {step === 'preview' && 'Select changes'}
          {step === 'complete' && 'Done'}
        </span>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Step 1: Input */}
      {step === 'input' && (
        <div className="space-y-6">
          {/* Scope Card - Full Width */}
          <Card>
            <CardHeader>
              <CardTitle>Scope</CardTitle>
              <CardDescription>
                What to analyze
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="space-y-2 min-w-[200px]">
                  <label className="text-sm font-medium">Scope</label>
                  <Select value={scope} onValueChange={(v) => setScope(v as AlignScope)} disabled={taskRunning}>
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

                {scope !== 'project' && (
                  <div className="space-y-2 min-w-[200px]">
                    <label className="text-sm font-medium">Version</label>
                    <Select value={selectedVersion} onValueChange={setSelectedVersion} disabled={taskRunning}>
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

                {(scope === 'phase' || scope === 'epic') && (
                  <div className="space-y-2 min-w-[200px]">
                    <label className="text-sm font-medium">Phase</label>
                    <Select value={selectedPhase} onValueChange={setSelectedPhase} disabled={taskRunning}>
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

                {scope === 'epic' && selectedPhase && (
                  <div className="space-y-2 min-w-[200px]">
                    <label className="text-sm font-medium">Epic</label>
                    <Select value={selectedEpic} onValueChange={setSelectedEpic} disabled={taskRunning}>
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
              </div>
            </CardContent>
          </Card>

          {/* Vision Card - Full Width */}
          <Card>
            <CardHeader>
              <CardTitle>Your Vision</CardTitle>
              <CardDescription>
                Describe what you want to build and your goals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Describe what you want to build and your goals...&#10;&#10;Example: I want to build a modern task management app that focuses on team collaboration. Key features should include real-time updates, easy task assignment, and progress tracking. The app should be simple to use without overwhelming users with options."
                value={vision}
                onChange={e => setVision(e.target.value)}
                rows={8}
                className="text-base"
                disabled={taskRunning}
              />

              {taskRunning ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing alignment... You can navigate away and come back.</span>
                </div>
              ) : (
                <Button
                  onClick={handleStartTask}
                  disabled={loading || !vision.trim()}
                  size="lg"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Target className="h-4 w-4 mr-2" />
                  )}
                  Analyze Alignment
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 'review' && result && (
        <div className="space-y-6">
          {/* Score and summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-6">
                <div className="text-center">
                  <div className={cn("text-5xl font-bold", getScoreColor(result.alignment_score))}>
                    {result.alignment_score}
                  </div>
                  <div className="text-sm text-muted-foreground">/ 100</div>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-lg mb-2">Alignment Score</h3>
                  <p className="text-muted-foreground">{result.summary}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Analyzed {result.analyzedCount} stories in {result.scopeDescription}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gaps */}
            {result.gaps?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Gaps ({result.gaps.length})</CardTitle>
                  <CardDescription>Missing capabilities</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
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
                </CardContent>
              </Card>
            )}

            {/* Misalignments */}
            {result.misalignments?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Misalignments ({result.misalignments.length})</CardTitle>
                  <CardDescription>Stories that may not serve the vision</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
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
                </CardContent>
              </Card>
            )}
          </div>

          {/* Summary counts */}
          <div className="flex gap-4 text-sm text-muted-foreground">
            {result.modifications?.length > 0 && (
              <span>{result.modifications.length} modifications suggested</span>
            )}
            {result.new_stories?.length > 0 && (
              <span>{result.new_stories.length} new stories suggested</span>
            )}
          </div>

          {/* Refine input */}
          <Card>
            <CardHeader>
              <CardTitle>Refine Analysis</CardTitle>
              <CardDescription>Add more context or ask to focus on specific areas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Add more context or ask Claude to focus on specific areas..."
                value={additionalInput}
                onChange={e => setAdditionalInput(e.target.value)}
                rows={3}
                disabled={refineLoading}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
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
                <Button onClick={() => setStep('preview')}>
                  Preview Changes
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && result && (
        <div className="space-y-6">
          {/* Modifications */}
          {result.modifications?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Modifications ({result.modifications.length})</CardTitle>
                <CardDescription>Click to select/deselect</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
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
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* New stories */}
          {result.new_stories?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>New Stories ({result.new_stories.length})</CardTitle>
                <CardDescription>Click to select/deselect</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
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
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Removals */}
          {result.misalignments?.filter(m => m.suggestion === 'remove').length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Remove Stories</CardTitle>
                <CardDescription>Click to select/deselect</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
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
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('review')}>
              Back to Review
            </Button>
            <Button onClick={handleApply} disabled={loading || totalChanges === 0}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Apply {totalChanges} Changes
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 'complete' && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h2 className="text-xl font-medium mb-2">Changes Applied</h2>
              <div className="text-muted-foreground space-y-1">
                {appliedCounts.applied > 0 && <p>Modified {appliedCounts.applied} stories</p>}
                {appliedCounts.added > 0 && <p>Added {appliedCounts.added} new stories</p>}
                {appliedCounts.removed > 0 && <p>Removed {appliedCounts.removed} stories</p>}
              </div>
              <Button onClick={reset} className="mt-6">
                Start New Alignment Check
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
