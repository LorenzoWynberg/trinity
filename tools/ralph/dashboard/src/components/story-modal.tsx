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
import { ExternalLink, GitBranch, CheckCircle2, Circle, Pencil, Loader2, AlertCircle, ChevronRight, CheckCircle, X, Check } from 'lucide-react'
import Link from 'next/link'
import type { Story, StoryStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const statusConfig: Record<StoryStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-500' },
  in_progress: { label: 'In Progress', className: 'bg-blue-500' },
  passed: { label: 'Passed', className: 'bg-yellow-500' },
  merged: { label: 'Merged', className: 'bg-green-500' },
  skipped: { label: 'Skipped', className: 'bg-purple-500' },
  blocked: { label: 'Blocked', className: 'bg-red-500' },
}

type SuggestedUpdate = {
  id: string
  title?: string
  reason?: string
  suggested_description?: string
  suggested_acceptance: string[]
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
  const [editStep, setEditStep] = useState<'view' | 'input' | 'review' | 'complete'>(startInEditMode ? 'input' : 'view')
  const [requestedChanges, setRequestedChanges] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Analysis results
  const [updatedDescription, setUpdatedDescription] = useState<string>('')
  const [updatedAcceptance, setUpdatedAcceptance] = useState<string[]>([])
  const [updatedIntent, setUpdatedIntent] = useState<string>('')
  const [relatedUpdates, setRelatedUpdates] = useState<SuggestedUpdate[]>([])
  const [summary, setSummary] = useState<string>('')
  const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(new Set())
  const [appliedCount, setAppliedCount] = useState(0)
  const [previewStory, setPreviewStory] = useState<SuggestedUpdate | null>(null)

  // Inline editing state
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [editCardText, setEditCardText] = useState('')

  // Preview iteration state
  const [iterateFeedback, setIterateFeedback] = useState('')
  const [iterating, setIterating] = useState(false)

  if (!story) return null

  const config = statusConfig[status]
  const branchName = `feat/story-${story.phase}.${story.epic}.${story.story_number}`
  const storyVersion = version || story.target_version || 'v0.1'

  const resetEdit = () => {
    setEditStep(startInEditMode ? 'input' : 'view')
    setRequestedChanges('')
    setUpdatedDescription('')
    setUpdatedAcceptance([])
    setUpdatedIntent('')
    setRelatedUpdates([])
    setSummary('')
    setSelectedUpdates(new Set())
    setAppliedCount(0)
    setError(null)
    setEditingCardId(null)
    setEditCardText('')
    setPreviewStory(null)
    setIterateFeedback('')
    setIterating(false)
  }

  const startEditCard = (id: string, acceptance: string[], e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingCardId(id)
    setEditCardText(acceptance.join('\n'))
  }

  const cancelEditCard = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingCardId(null)
    setEditCardText('')
  }

  const saveEditCard = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newAcceptance = editCardText.split('\n').filter(l => l.trim())
    if (id === story?.id) {
      setUpdatedAcceptance(newAcceptance)
    } else {
      setRelatedUpdates(prev => prev.map(r =>
        r.id === id ? { ...r, suggested_acceptance: newAcceptance } : r
      ))
    }
    setEditingCardId(null)
    setEditCardText('')
  }

  const handleAnalyze = async () => {
    if (!requestedChanges.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/prd/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: storyVersion,
          storyId: story.id,
          requestedChanges
        })
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        // New API format: target + related_updates
        setUpdatedDescription(data.target?.suggested_description || '')
        setUpdatedAcceptance(data.target?.suggested_acceptance || [])
        setUpdatedIntent(data.target?.suggested_intent || '')
        setSummary(data.summary || '')

        // Map related_updates to our format
        const related: SuggestedUpdate[] = (data.related_updates || []).map((r: any) => ({
          id: r.id,
          title: r.title,
          reason: r.reason,
          suggested_description: r.suggested_description,
          suggested_acceptance: r.suggested_acceptance || []
        }))
        setRelatedUpdates(related)

        // Pre-select all updates
        const ids = new Set([story.id, ...related.map(r => r.id)])
        setSelectedUpdates(ids)
        setEditStep('review')
      }
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

    // Add main story update if selected
    if (selectedUpdates.has(story.id) && (updatedAcceptance.length > 0 || updatedDescription)) {
      updates.push({
        id: story.id,
        suggested_description: updatedDescription || undefined,
        suggested_acceptance: updatedAcceptance,
        suggested_intent: updatedIntent || undefined
      })
    }

    // Add related updates
    for (const rel of relatedUpdates) {
      if (selectedUpdates.has(rel.id)) {
        updates.push({
          id: rel.id,
          suggested_description: rel.suggested_description,
          suggested_acceptance: rel.suggested_acceptance
        })
      }
    }

    try {
      const res = await fetch('/api/prd/story', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: storyVersion, updates })
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setAppliedCount(data.applied)
        setEditStep('complete')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleUpdate = (id: string) => {
    setSelectedUpdates(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleIterate = async () => {
    if (!previewStory || !iterateFeedback.trim()) return
    setIterating(true)
    setError(null)

    try {
      // Build all current refinements for related story detection
      const allRefinements = [
        {
          id: story.id,
          title: story.title,
          status: 'needs_work' as const,
          issues: [],
          suggested_description: updatedDescription,
          suggested_acceptance: updatedAcceptance,
          tags: story.tags,
          depends_on: story.depends_on
        },
        ...relatedUpdates.map(r => ({
          id: r.id,
          title: r.title || '',
          status: 'needs_work' as const,
          issues: [],
          suggested_description: r.suggested_description || '',
          suggested_acceptance: r.suggested_acceptance,
          tags: [] as string[],
          depends_on: [] as string[]
        }))
      ]

      const res = await fetch('/api/prd/refine/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: previewStory.id,
          title: previewStory.title,
          currentDescription: previewStory.suggested_description,
          currentAcceptance: previewStory.suggested_acceptance,
          userFeedback: iterateFeedback,
          tags: previewStory.id === story.id ? story.tags : [],
          depends_on: previewStory.id === story.id ? story.depends_on : [],
          allRefinements
        })
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        // Update the target story
        if (data.target) {
          if (previewStory.id === story.id) {
            setUpdatedDescription(data.target.suggested_description || updatedDescription)
            setUpdatedAcceptance(data.target.suggested_acceptance || updatedAcceptance)
          } else {
            setRelatedUpdates(prev => prev.map(r =>
              r.id === previewStory.id
                ? {
                    ...r,
                    suggested_description: data.target.suggested_description || r.suggested_description,
                    suggested_acceptance: data.target.suggested_acceptance || r.suggested_acceptance
                  }
                : r
            ))
          }
          // Update preview
          setPreviewStory({
            ...previewStory,
            suggested_description: data.target.suggested_description || previewStory.suggested_description,
            suggested_acceptance: data.target.suggested_acceptance || previewStory.suggested_acceptance
          })
        }

        // Handle any related updates from the iteration
        if (data.related_updates?.length > 0) {
          for (const update of data.related_updates) {
            if (update.id === story.id) {
              setUpdatedDescription(update.suggested_description || updatedDescription)
              setUpdatedAcceptance(update.suggested_acceptance || updatedAcceptance)
            } else {
              // Check if this story is already in relatedUpdates
              const exists = relatedUpdates.some(r => r.id === update.id)
              if (exists) {
                setRelatedUpdates(prev => prev.map(r =>
                  r.id === update.id
                    ? {
                        ...r,
                        reason: update.reason || r.reason,
                        suggested_description: update.suggested_description || r.suggested_description,
                        suggested_acceptance: update.suggested_acceptance || r.suggested_acceptance
                      }
                    : r
                ))
              } else {
                // Add new related update
                setRelatedUpdates(prev => [...prev, {
                  id: update.id,
                  title: update.title,
                  reason: update.reason,
                  suggested_description: update.suggested_description,
                  suggested_acceptance: update.suggested_acceptance || []
                }])
                // Auto-select it
                setSelectedUpdates(prev => new Set([...prev, update.id]))
              }
            }
          }
        }

        setIterateFeedback('')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIterating(false)
    }
  }

  const isEditing = editStep !== 'view'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetEdit(); onOpenChange(o) }}>
      <DialogContent className="md:!max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="font-mono">{story.id}</DialogTitle>
            <Badge className={config.className}>{config.label}</Badge>
            {editStep === 'view' && status !== 'merged' && (
              <Button variant="ghost" size="sm" onClick={() => setEditStep('input')}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Step indicator for edit mode */}
        {isEditing && (
          <div className="flex items-center gap-2 py-2">
            {['input', 'review', 'complete'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                  editStep === s ? "bg-primary text-primary-foreground cyber-dark:bg-accent cyber-dark:text-accent-foreground" :
                    (editStep === 'complete' || (editStep === 'review' && i === 0))
                      ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {(editStep === 'complete' || (editStep === 'review' && i === 0)) ? <CheckCircle className="h-3 w-3" /> : i + 1}
                </div>
                {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />}
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4">
          {!isEditing && (
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

          {/* Step: Input */}
          {editStep === 'input' && (
            <div className="space-y-4 py-2">
              {loading ? (
                <div className="text-center py-6">
                  <Loader2 className="h-10 w-10 mx-auto text-primary mb-3 animate-spin" />
                  <p className="font-medium mb-1">Analyzing changes...</p>
                  <p className="text-sm text-muted-foreground">
                    Claude is reviewing your request. This may take a minute.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <h4 className="text-sm font-medium mb-1">{story.title}</h4>
                    <p className="text-xs text-muted-foreground">Describe changes for {story.id}</p>
                  </div>
                  <Textarea
                    placeholder="What changes do you want to make to this story?&#10;&#10;Example: Add specific validation rules, split into smaller tasks, clarify acceptance criteria..."
                    value={requestedChanges}
                    onChange={e => setRequestedChanges(e.target.value)}
                    rows={4}
                  />
                </>
              )}
            </div>
          )}

          {/* Step: Review */}
          {editStep === 'review' && (
            <div className="space-y-3 py-2">
              {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
              <p className="text-xs font-medium">Select updates to apply:</p>

              {/* Main story update row */}
              <div
                className={cn(
                  "p-3 rounded-md border transition-all cursor-pointer hover:border-primary",
                  selectedUpdates.has(story.id) && "ring-2 ring-primary"
                )}
                onClick={() => toggleUpdate(story.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{story.id}</span>
                      <Badge variant="outline" className="text-[10px]">this story</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{story.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {updatedAcceptance.length} criteria • {updatedDescription ? 'description updated' : 'no description change'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPreviewStory({
                          id: story.id,
                          title: story.title,
                          suggested_description: updatedDescription,
                          suggested_acceptance: updatedAcceptance
                        })
                      }}
                    >
                      Preview
                    </Button>
                    <div className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center shrink-0",
                      selectedUpdates.has(story.id) ? "bg-primary border-primary" : "border-muted-foreground"
                    )}>
                      {selectedUpdates.has(story.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Related updates rows */}
              {relatedUpdates.map(rel => (
                <div
                  key={rel.id}
                  className={cn(
                    "p-3 rounded-md border transition-all cursor-pointer hover:border-amber-500 bg-amber-500/10",
                    selectedUpdates.has(rel.id) && "ring-2 ring-primary"
                  )}
                  onClick={() => toggleUpdate(rel.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{rel.id}</span>
                        <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">related</Badge>
                      </div>
                      {rel.title && <p className="text-xs text-muted-foreground mt-1 truncate">{rel.title}</p>}
                      {rel.reason && <p className="text-xs text-amber-600 mt-0.5 truncate">{rel.reason}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {rel.suggested_acceptance.length} criteria • {rel.suggested_description ? 'description updated' : 'no description change'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPreviewStory(rel)
                        }}
                      >
                        Preview
                      </Button>
                      <div className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center shrink-0",
                        selectedUpdates.has(rel.id) ? "bg-primary border-primary" : "border-muted-foreground"
                      )}>
                        {selectedUpdates.has(rel.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step: Complete */}
          {editStep === 'complete' && (
            <div className="text-center py-8">
              <CheckCircle className="h-10 w-10 mx-auto text-green-500 mb-3" />
              <p className="font-medium">Done!</p>
              <p className="text-sm text-muted-foreground">Applied {appliedCount} updates</p>
            </div>
          )}

          {/* View mode content */}
          {editStep === 'view' && (
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

        {/* Footer with navigation buttons */}
        {isEditing && (
          <DialogFooter className="pt-4 border-t flex-col sm:flex-row gap-2">
            {editStep === 'input' && !loading && (
              <>
                <Button variant="outline" onClick={() => { resetEdit(); onOpenChange(false) }}>Cancel</Button>
                <Button onClick={handleAnalyze} disabled={loading || !requestedChanges.trim()}>
                  Analyze
                </Button>
              </>
            )}
            {editStep === 'review' && (
              <>
                {loading && (
                  <p className="text-xs text-muted-foreground mr-auto">
                    Applying updates to PRD...
                  </p>
                )}
                <Button variant="outline" onClick={() => setEditStep('input')} disabled={loading}>Back</Button>
                <Button onClick={handleApply} disabled={loading || selectedUpdates.size === 0}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Apply {selectedUpdates.size} Update{selectedUpdates.size !== 1 ? 's' : ''}
                </Button>
              </>
            )}
            {editStep === 'complete' && (
              <Button onClick={() => { resetEdit(); onOpenChange(false) }}>Done</Button>
            )}
          </DialogFooter>
        )}

        {/* Preview Modal */}
        {previewStory && (
          <Dialog open={!!previewStory} onOpenChange={(o) => !o && setPreviewStory(null)}>
            <DialogContent className="md:!max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle className="font-mono text-base">{previewStory.id}</DialogTitle>
                  <Badge variant="outline">Suggested Changes</Badge>
                </div>
                {previewStory.title && (
                  <p className="text-sm text-muted-foreground mt-1">{previewStory.title}</p>
                )}
              </DialogHeader>

              <div className="flex-1 overflow-y-auto space-y-4 py-2">
                {previewStory.reason && (
                  <div className="bg-amber-500/10 p-3 rounded-md">
                    <h4 className="text-xs font-medium text-amber-600 mb-1">Why this update is suggested</h4>
                    <p className="text-sm">{previewStory.reason}</p>
                  </div>
                )}

                {previewStory.suggested_description && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Suggested Description</h4>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                      {previewStory.suggested_description}
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium mb-2">Suggested Acceptance Criteria</h4>
                  <ul className="space-y-2">
                    {previewStory.suggested_acceptance.map((ac, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm bg-muted/50 p-2 rounded-md">
                        <span className="bg-primary/10 text-primary text-xs font-mono px-1.5 py-0.5 rounded shrink-0">
                          {i + 1}
                        </span>
                        <span>{ac}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <h4 className="text-sm font-medium">Want changes? Describe them below:</h4>
                <Textarea
                  placeholder="e.g., Make criteria more specific, add error handling, split into smaller tasks..."
                  value={iterateFeedback}
                  onChange={e => setIterateFeedback(e.target.value)}
                  rows={2}
                  className="text-sm"
                  disabled={iterating}
                />
                <div className="flex items-center justify-end gap-2">
                  {iterating && (
                    <p className="text-xs text-muted-foreground mr-auto">
                      Regenerating suggestions...
                    </p>
                  )}
                  <Button variant="outline" onClick={() => { setPreviewStory(null); setIterateFeedback('') }} disabled={iterating}>
                    Close
                  </Button>
                  <Button
                    onClick={handleIterate}
                    disabled={iterating || !iterateFeedback.trim()}
                  >
                    {iterating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Regenerate
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  )
}
