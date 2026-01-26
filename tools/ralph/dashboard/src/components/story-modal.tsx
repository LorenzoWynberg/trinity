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

type RelatedUpdate = {
  id: string
  reason: string
  suggestedAcceptance: string[]
}

type StoryModalProps = {
  story: Story | null
  status: StoryStatus
  open: boolean
  onOpenChange: (open: boolean) => void
  version?: string
}

export function StoryModal({ story, status, open, onOpenChange, version }: StoryModalProps) {
  const [editStep, setEditStep] = useState<'view' | 'input' | 'review' | 'complete'>('view')
  const [requestedChanges, setRequestedChanges] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Analysis results
  const [updatedAcceptance, setUpdatedAcceptance] = useState<string[]>([])
  const [updatedIntent, setUpdatedIntent] = useState<string>('')
  const [relatedUpdates, setRelatedUpdates] = useState<RelatedUpdate[]>([])
  const [summary, setSummary] = useState<string>('')
  const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(new Set())
  const [appliedCount, setAppliedCount] = useState(0)

  // Inline editing state
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [editCardText, setEditCardText] = useState('')

  if (!story) return null

  const config = statusConfig[status]
  const branchName = `feat/story-${story.phase}.${story.epic}.${story.story_number}`
  const storyVersion = version || story.target_version || 'v0.1'

  const resetEdit = () => {
    setEditStep('view')
    setRequestedChanges('')
    setUpdatedAcceptance([])
    setUpdatedIntent('')
    setRelatedUpdates([])
    setSummary('')
    setSelectedUpdates(new Set())
    setAppliedCount(0)
    setError(null)
    setEditingCardId(null)
    setEditCardText('')
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
        r.id === id ? { ...r, suggestedAcceptance: newAcceptance } : r
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
        setUpdatedAcceptance(data.updatedStory?.acceptance || [])
        setUpdatedIntent(data.updatedStory?.intent || '')
        setRelatedUpdates(data.relatedUpdates || [])
        setSummary(data.summary || '')
        // Pre-select all updates
        const ids = new Set([story.id, ...(data.relatedUpdates || []).map((r: RelatedUpdate) => r.id)])
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
    if (selectedUpdates.has(story.id) && updatedAcceptance.length > 0) {
      updates.push({
        id: story.id,
        acceptance: updatedAcceptance,
        intent: updatedIntent || undefined
      })
    }

    // Add related updates
    for (const rel of relatedUpdates) {
      if (selectedUpdates.has(rel.id)) {
        updates.push({
          id: rel.id,
          acceptance: rel.suggestedAcceptance
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

  const isEditing = editStep !== 'view'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetEdit(); onOpenChange(o) }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
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
                  editStep === s ? "bg-primary text-primary-foreground" :
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
              <h3 className="font-medium">{story.title}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <span>Phase {story.phase}</span>
                <span>·</span>
                <span>Epic {story.epic}</span>
                <span>·</span>
                <span>{storyVersion}</span>
              </div>
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
            </div>
          )}

          {/* Step: Review */}
          {editStep === 'review' && (
            <div className="space-y-3 py-2">
              {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
              <p className="text-xs font-medium">Click to select/deselect updates:</p>

              {/* Main story update */}
              <div
                className={cn(
                  "p-3 rounded-md border transition-all",
                  editingCardId !== story.id && "cursor-pointer hover:border-primary",
                  selectedUpdates.has(story.id) && "ring-2 ring-primary"
                )}
                onClick={() => editingCardId !== story.id && toggleUpdate(story.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm">{story.id} (this story)</span>
                  <div className="flex items-center gap-2">
                    {editingCardId === story.id ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={(e) => cancelEditCard(e)}>
                          <X className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => saveEditCard(story.id, e)}>
                          <Check className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={(e) => startEditCard(story.id, updatedAcceptance, e)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center",
                      selectedUpdates.has(story.id) ? "bg-primary border-primary" : "border-muted-foreground"
                    )}>
                      {selectedUpdates.has(story.id) && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  </div>
                </div>
                {editingCardId === story.id ? (
                  <Textarea
                    value={editCardText}
                    onChange={e => setEditCardText(e.target.value)}
                    rows={4}
                    className="text-xs"
                    placeholder="One acceptance criterion per line"
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <ul className="list-disc list-inside">
                    {updatedAcceptance.map((a, i) => (
                      <li key={i} className="text-xs">{a}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Related updates */}
              {relatedUpdates.map(rel => (
                <div
                  key={rel.id}
                  className={cn(
                    "p-3 rounded-md border transition-all bg-amber-500/10",
                    editingCardId !== rel.id && "cursor-pointer hover:border-amber-500",
                    selectedUpdates.has(rel.id) && "ring-2 ring-primary"
                  )}
                  onClick={() => editingCardId !== rel.id && toggleUpdate(rel.id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm">{rel.id}</span>
                    <div className="flex items-center gap-2">
                      {editingCardId === rel.id ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={(e) => cancelEditCard(e)}>
                            <X className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={(e) => saveEditCard(rel.id, e)}>
                            <Check className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={(e) => startEditCard(rel.id, rel.suggestedAcceptance, e)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center",
                        selectedUpdates.has(rel.id) ? "bg-primary border-primary" : "border-muted-foreground"
                      )}>
                        {selectedUpdates.has(rel.id) && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{rel.reason}</p>
                  {editingCardId === rel.id ? (
                    <Textarea
                      value={editCardText}
                      onChange={e => setEditCardText(e.target.value)}
                      rows={3}
                      className="text-xs"
                      placeholder="One acceptance criterion per line"
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <ul className="list-disc list-inside">
                      {rel.suggestedAcceptance.map((a, i) => (
                        <li key={i} className="text-xs">{a}</li>
                      ))}
                    </ul>
                  )}
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
                  <h4 className="text-sm font-medium mb-1">Intent</h4>
                  <p className="text-sm text-muted-foreground">{story.intent}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium mb-2">Acceptance Criteria</h4>
                <ul className="space-y-1">
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
                <div>
                  <h4 className="text-sm font-medium mb-1">Dependencies</h4>
                  <div className="flex flex-wrap gap-1">
                    {story.depends_on.map(dep => (
                      <Badge key={dep} variant="outline" className="font-mono text-xs">
                        {dep}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GitBranch className="h-4 w-4" />
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
          <DialogFooter className="pt-4 border-t">
            {editStep === 'input' && (
              <>
                <Button variant="outline" onClick={resetEdit}>Cancel</Button>
                <Button onClick={handleAnalyze} disabled={loading || !requestedChanges.trim()}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Analyze
                </Button>
              </>
            )}
            {editStep === 'review' && (
              <>
                <Button variant="outline" onClick={() => setEditStep('input')}>Back</Button>
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
      </DialogContent>
    </Dialog>
  )
}
