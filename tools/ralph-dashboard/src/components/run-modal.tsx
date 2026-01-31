'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  Loader2,
  Play,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  Bot,
  Square,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { Story } from '@/lib/types'
import { useHandoffs } from '@/lib/query'

type RunStep = 'config' | 'ext-deps' | 'validation' | 'execute' | 'review' | 'done'

type RunMode = 'manual' | 'autopilot'

interface RunConfig {
  version: string
  storyId: string | null // null = next best
  mode: RunMode
  autoClarify: boolean
  autoPR: boolean
  autoMerge: boolean
}

interface StoryScore {
  storyId: string
  score: number
  proximity: number
  tagOverlap: number
  blockerValue: number
}

interface RunModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialVersion?: string
}

const STEPS: RunStep[] = ['config', 'ext-deps', 'validation', 'execute', 'review', 'done']

const STEP_LABELS: Record<RunStep, string> = {
  'config': 'Config',
  'ext-deps': 'Ext Deps',
  'validation': 'Validate',
  'execute': 'Execute',
  'review': 'Review',
  'done': 'Done',
}

export function RunModal({ open, onOpenChange, initialVersion = 'v0.1' }: RunModalProps) {
  // Config state
  const [stories, setStories] = useState<Story[]>([])
  const [scoredStories, setScoredStories] = useState<StoryScore[]>([])
  const [config, setConfig] = useState<RunConfig>({
    version: initialVersion,
    storyId: null,
    mode: 'manual',
    autoClarify: false,
    autoPR: false,
    autoMerge: false,
  })

  // Wizard state
  const [step, setStep] = useState<RunStep>('config')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Story state (populated when running)
  const [currentStory, setCurrentStory] = useState<Story | null>(null)
  const [_branch, setBranch] = useState<string | null>(null)
  const [prUrl, setPrUrl] = useState<string | null>(null)

  // Gate state
  const [extDeps, setExtDeps] = useState<{ name: string; description: string }[]>([])
  const [extDepsReport, setExtDepsReport] = useState('')
  const [validationQuestions, setValidationQuestions] = useState<string[]>([])
  const [clarification, setClarification] = useState('')
  const [feedback, setFeedback] = useState('')

  // Execution state
  const [executionLogs, setExecutionLogs] = useState<string[]>([])
  const [iteration, setIteration] = useState(1)
  const [stopAfterCurrent, setStopAfterCurrent] = useState(false)

  // Agent handoffs (polls during execution)
  const { data: handoffState } = useHandoffs(currentStory?.id)

  // Sync version with page prop
  useEffect(() => {
    if (initialVersion && initialVersion !== config.version) {
      setConfig(prev => ({ ...prev, version: initialVersion }))
    }
  }, [open])

  // Fetch stories when version changes
  useEffect(() => {
    if (open && config.version) {
      // Fetch scored stories for smart selection
      fetch(`/api/run?version=${config.version}`)
        .then(res => res.json())
        .then(data => {
          if (data.scoredStories) {
            setScoredStories(data.scoredStories)
          }
        })
        .catch(console.error)

      // Fetch PRD stories
      api.prd.get(config.version)
        .then(data => {
          if (data.stories) {
            setStories(data.stories.filter((s: Story) => !s.merged && !s.skipped))
          }
        })
        .catch(console.error)
    }
  }, [open, config.version])

  // Handle mode change
  const handleModeChange = (mode: RunMode) => {
    if (mode === 'autopilot') {
      setConfig(prev => ({
        ...prev,
        mode,
        autoClarify: true,
        autoPR: true,
        autoMerge: true,
      }))
    } else {
      setConfig(prev => ({ ...prev, mode }))
    }
  }

  const reset = () => {
    setStep('config')
    setLoading(false)
    setError(null)
    setCurrentStory(null)
    setBranch(null)
    setPrUrl(null)
    setExtDeps([])
    setExtDepsReport('')
    setValidationQuestions([])
    setClarification('')
    setFeedback('')
    setExecutionLogs([])
    setIteration(1)
    setStopAfterCurrent(false)
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const addLog = useCallback((message: string) => {
    setExecutionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }, [])

  // Start the run
  const handleStartRun = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: config.version,
          action: 'start',
          config: {
            singleStoryId: config.storyId,
            autoMode: config.mode === 'autopilot',
            autoClarify: config.autoClarify,
            autoPR: config.autoPR,
            autoMerge: config.autoMerge,
          },
        }),
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error)
        return
      }

      // Handle the response
      await handleRunResponse(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Continue after gate response
  const continueRun = async (gateResponse?: { type: string; response: any }) => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: config.version,
          action: 'continue',
          config: {
            singleStoryId: config.storyId,
            autoMode: config.mode === 'autopilot',
            autoClarify: config.autoClarify,
            autoPR: config.autoPR,
            autoMerge: config.autoMerge,
          },
          gateResponse,
        }),
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error)
        return
      }

      await handleRunResponse(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Handle run API response
  const handleRunResponse = async (data: any) => {
    // Log events
    if (data.event?.data?.message) {
      addLog(data.event.data.message)
    }

    // Update story info
    if (data.storyId) {
      const story = stories.find(s => s.id === data.storyId)
      if (story) setCurrentStory(story)
    }

    // Handle gate requests
    if (data.gateRequest) {
      const gate = data.gateRequest

      if (gate.type === 'external_deps') {
        setExtDeps(gate.data.deps || [])
        if (gate.data.story) setCurrentStory(gate.data.story)
        setStep('ext-deps')
        return
      }

      if (gate.type === 'validation') {
        setValidationQuestions(gate.data.questions || [])
        if (gate.data.story) setCurrentStory(gate.data.story)
        setStep('validation')
        return
      }

      if (gate.type === 'pr_review') {
        setPrUrl(gate.data.prUrl)
        if (gate.data.story) setCurrentStory(gate.data.story)
        setStep('review')
        return
      }
    }

    // Handle status changes
    if (data.status === 'running_claude' || data.status === 'creating_branch') {
      setStep('execute')
      // Continue polling for updates
      setTimeout(() => continueRun(), 2000)
      return
    }

    if (data.status === 'complete') {
      setStep('done')
      return
    }

    if (data.status === 'blocked' || data.status === 'error') {
      setError(data.event?.data?.message || 'Execution blocked')
      return
    }

    // If idle, execution finished for this story
    if (data.status === 'idle') {
      // In autopilot mode, auto-continue to next story unless stopped
      if (config.mode === 'autopilot' && !stopAfterCurrent) {
        addLog('Story passed. Autopilot continuing to next story...')

        // Reset state for next story and continue
        setCurrentStory(null)
        setBranch(null)
        setPrUrl(null)
        setExtDeps([])
        setExtDepsReport('')
        setValidationQuestions([])
        setClarification('')
        setFeedback('')
        setIteration(1)
        setConfig(prev => ({ ...prev, storyId: null })) // Next best story

        // Short delay before starting next story
        setTimeout(() => {
          handleStartRun()
        }, 1000)
        return
      }

      setStep('done')
    }
  }

  // Gate handlers
  const handleExtDepsSkip = () => {
    continueRun({ type: 'external_deps', response: { action: 'skip' } })
  }

  const handleExtDepsSubmit = () => {
    continueRun({ type: 'external_deps', response: { action: 'submit', report: extDepsReport } })
  }

  const handleValidationSkip = () => {
    continueRun({ type: 'validation', response: { action: 'skip' } })
  }

  const handleValidationAuto = () => {
    continueRun({ type: 'validation', response: { action: 'auto' } })
  }

  const handleValidationSubmit = () => {
    continueRun({ type: 'validation', response: { action: 'clarify', clarification } })
  }

  const handleReviewMerge = () => {
    continueRun({ type: 'pr_review', response: { action: 'merge' } })
  }

  const handleReviewFeedback = () => {
    setIteration(prev => prev + 1)
    continueRun({ type: 'pr_review', response: { action: 'feedback', feedback } })
    setFeedback('')
    setStep('execute')
  }

  // Get step index for indicator
  const getStepIndex = (s: RunStep) => STEPS.indexOf(s)
  const currentStepIndex = getStepIndex(step)

  // Determine which steps to show (skip ext-deps and validation if not needed)
  const visibleSteps = STEPS.filter(s => {
    if (s === 'ext-deps' && extDeps.length === 0 && step !== 'ext-deps') return false
    if (s === 'validation' && validationQuestions.length === 0 && step !== 'validation') return false
    return true
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o) }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Run Story
          </DialogTitle>
          <DialogDescription className="cyber-dark:text-secondary-foreground">
            {step === 'config' && 'Configure and start the execution'}
            {step === 'ext-deps' && 'Provide external dependency details'}
            {step === 'validation' && 'Clarify story requirements'}
            {step === 'execute' && 'Claude is implementing the story'}
            {step === 'review' && 'Review the PR and decide next steps'}
            {step === 'done' && 'Story passed - PR ready for review'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 py-2 overflow-x-auto">
          {visibleSteps.map((s, i) => {
            const stepIdx = getStepIndex(s)
            const isComplete = stepIdx < currentStepIndex
            const isCurrent = s === step

            return (
              <div key={s} className="flex items-center">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
                  isCurrent ? "bg-primary text-primary-foreground cyber-dark:bg-accent cyber-dark:text-accent-foreground" :
                    isComplete ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {isComplete ? <CheckCircle className="h-3 w-3" /> : i + 1}
                </div>
                <span className={cn(
                  "text-xs ml-1 mr-2 hidden sm:inline",
                  isCurrent ? "font-medium" : "text-muted-foreground"
                )}>
                  {STEP_LABELS[s]}
                </span>
                {i < visibleSteps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-center gap-2 text-sm mb-4">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Step: Config */}
          {step === 'config' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Story</label>
                  <Select
                    value={config.storyId || 'next'}
                    onValueChange={(v) => setConfig(prev => ({ ...prev, storyId: v === 'next' ? null : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="next">Next best (smart selection)</SelectItem>
                      {scoredStories.slice(0, 10).map(s => (
                        <SelectItem key={s.storyId} value={s.storyId}>
                          {s.storyId} (score: {s.score.toFixed(1)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Mode</label>
                  <Select
                    value={config.mode}
                    onValueChange={(v) => handleModeChange(v as RunMode)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="autopilot">Autopilot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Options */}
                <div className="space-y-3 pt-2">
                  <label className={cn(
                    "flex items-center gap-3 cursor-pointer",
                    config.mode === 'autopilot' && "opacity-60 cursor-not-allowed"
                  )}>
                    <input
                      type="checkbox"
                      checked={config.autoClarify}
                      onChange={(e) => setConfig(prev => ({ ...prev, autoClarify: e.target.checked }))}
                      disabled={config.mode === 'autopilot'}
                      className="rounded"
                    />
                    <span className="text-sm">Auto-clarify (skip validation questions)</span>
                  </label>

                  <label className={cn(
                    "flex items-center gap-3 cursor-pointer",
                    config.mode === 'autopilot' && "opacity-60 cursor-not-allowed"
                  )}>
                    <input
                      type="checkbox"
                      checked={config.autoPR}
                      onChange={(e) => setConfig(prev => ({ ...prev, autoPR: e.target.checked }))}
                      disabled={config.mode === 'autopilot'}
                      className="rounded"
                    />
                    <span className="text-sm">Auto-PR (create PR after execution)</span>
                  </label>

                  <label className={cn(
                    "flex items-center gap-3 cursor-pointer",
                    config.mode === 'autopilot' && "opacity-60 cursor-not-allowed"
                  )}>
                    <input
                      type="checkbox"
                      checked={config.autoMerge}
                      onChange={(e) => setConfig(prev => ({ ...prev, autoMerge: e.target.checked }))}
                      disabled={config.mode === 'autopilot'}
                      className="rounded"
                    />
                    <span className="text-sm">Auto-merge (merge without review)</span>
                  </label>
                </div>

                {/* Autopilot description */}
                {config.mode === 'autopilot' && (
                  <div className="bg-muted/50 border rounded-md p-3 text-sm">
                    <div className="flex items-center gap-2 font-medium mb-1">
                      <Bot className="h-4 w-4" />
                      Autopilot Mode
                    </div>
                    <p className="text-muted-foreground">
                      Runs without stopping. Makes reasonable assumptions for unclear requirements,
                      creates PRs automatically, and merges without review.
                    </p>
                  </div>
                )}
              </div>

              <Button onClick={handleStartRun} disabled={loading} className="w-full" size="lg">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Run
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step: External Deps */}
          {step === 'ext-deps' && (
            <div className="space-y-4">
              {currentStory && (
                <div className="bg-muted/50 p-3 rounded-md">
                  <div className="font-mono text-sm">{currentStory.id}</div>
                  <div className="font-medium">{currentStory.title}</div>
                </div>
              )}

              <div>
                <div className="font-medium mb-2">External Dependencies Required:</div>
                <ul className="list-disc pl-5 space-y-1">
                  {extDeps.map((dep, i) => (
                    <li key={i}>
                      <strong>{dep.name}</strong>: {dep.description}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Describe how these were implemented:
                </label>
                <Textarea
                  value={extDepsReport}
                  onChange={(e) => setExtDepsReport(e.target.value)}
                  placeholder="e.g., Stripe API at POST /api/payments/charge, Auth via /api/auth/verify..."
                  rows={4}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExtDepsSkip} disabled={loading}>
                  Skip Story
                </Button>
                <Button onClick={handleExtDepsSubmit} disabled={loading || !extDepsReport.trim()} className="flex-1">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
                </Button>
              </div>
            </div>
          )}

          {/* Step: Validation */}
          {step === 'validation' && (
            <div className="space-y-4">
              {currentStory && (
                <div className="bg-muted/50 p-3 rounded-md">
                  <div className="font-mono text-sm">{currentStory.id}</div>
                  <div className="font-medium">{currentStory.title}</div>
                </div>
              )}

              <div>
                <div className="font-medium mb-2">Questions:</div>
                <ul className="list-disc pl-5 space-y-1">
                  {validationQuestions.map((q, i) => (
                    <li key={i} className="text-sm">{q}</li>
                  ))}
                </ul>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Provide clarification:
                </label>
                <Textarea
                  value={clarification}
                  onChange={(e) => setClarification(e.target.value)}
                  placeholder="Clarify the requirements..."
                  rows={4}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleValidationSkip} disabled={loading}>
                  Skip
                </Button>
                <Button variant="outline" onClick={handleValidationAuto} disabled={loading}>
                  Auto
                </Button>
                <Button onClick={handleValidationSubmit} disabled={loading || !clarification.trim()} className="flex-1">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
                </Button>
              </div>
            </div>
          )}

          {/* Step: Execute */}
          {step === 'execute' && (
            <div className="space-y-4">
              {currentStory && (
                <div className="bg-muted/50 p-3 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm">{currentStory.id}</div>
                      <div className="font-medium">{currentStory.title}</div>
                    </div>
                    {iteration > 1 && (
                      <div className="text-sm text-muted-foreground">
                        Iteration {iteration}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Agent Pipeline */}
              <div className="flex items-center justify-between py-2">
                {['analyst', 'implementer', 'reviewer', 'refactorer', 'documenter'].map((agent, i) => {
                  const isActive = handoffState?.currentAgent === agent
                  const isDone = handoffState?.handoffs?.some(
                    (h: any) => h.from_agent === agent && h.status === 'accepted'
                  )

                  return (
                    <div key={agent} className="flex items-center">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                        isActive && "bg-blue-500 text-white animate-pulse",
                        isDone && !isActive && "bg-green-500 text-white",
                        !isActive && !isDone && "bg-muted text-muted-foreground"
                      )}>
                        {isDone && !isActive ? <CheckCircle className="h-4 w-4" /> : agent[0].toUpperCase()}
                      </div>
                      {i < 4 && <ChevronRight className="h-3 w-3 mx-1 text-muted-foreground" />}
                    </div>
                  )
                })}
              </div>

              <div className="text-center py-4">
                <Loader2 className="h-10 w-10 mx-auto text-primary mb-3 animate-spin" />
                <p className="text-base font-medium mb-1">
                  {handoffState?.currentAgent
                    ? `${handoffState.currentAgent.charAt(0).toUpperCase() + handoffState.currentAgent.slice(1)} is working...`
                    : 'Starting...'}
                </p>
                <p className="text-muted-foreground text-sm">
                  {handoffState?.phase
                    ? `Phase: ${handoffState.phase}`
                    : 'Initializing agent pipeline'}
                </p>
              </div>

              {executionLogs.length > 0 && (
                <div className="bg-muted/30 rounded-md p-3 max-h-32 overflow-y-auto">
                  <div className="font-mono text-xs space-y-1">
                    {executionLogs.map((log, i) => (
                      <div key={i}>{log}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stop after this story option (autopilot mode) */}
              {config.mode === 'autopilot' && (
                <div className="pt-4 border-t">
                  {stopAfterCurrent ? (
                    <div className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3">
                      <span className="text-sm">Will stop after this story completes</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStopAfterCurrent(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setStopAfterCurrent(true)}
                      className="w-full"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop after this story
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              {currentStory && (
                <div className="bg-muted/50 p-3 rounded-md">
                  <div className="font-mono text-sm">{currentStory.id}</div>
                  <div className="font-medium">{currentStory.title}</div>
                </div>
              )}

              <div className="bg-green-500/10 border border-green-500/30 rounded-md p-4">
                <div className="flex items-center gap-2 font-medium mb-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  PR Ready for Review
                </div>
                {prUrl && (
                  <a
                    href={prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline flex items-center gap-1"
                  >
                    {prUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Feedback (optional):
                </label>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Request changes or provide feedback..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleReviewFeedback}
                  disabled={loading || !feedback.trim()}
                >
                  Request Changes
                </Button>
                <Button onClick={handleReviewMerge} disabled={loading} className="flex-1">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Merge PR'}
                </Button>
              </div>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <p className="text-xl font-medium mb-2">Story Passed!</p>
              {currentStory && (
                <p className="text-muted-foreground mb-4">
                  {currentStory.id}: {currentStory.title}
                </p>
              )}
              {prUrl && (
                <a
                  href={prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:underline flex items-center justify-center gap-1 mb-6"
                >
                  View PR
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {stopAfterCurrent && config.mode === 'autopilot' && (
                <p className="text-sm text-muted-foreground mb-4">
                  Autopilot stopped as requested.
                </p>
              )}
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button onClick={() => {
                  reset()
                  setConfig(prev => ({ ...prev, storyId: null }))
                }}>
                  Run Next Story
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
