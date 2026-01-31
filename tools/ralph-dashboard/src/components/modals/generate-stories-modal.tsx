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
import { Loader2, Wand2, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useTaskContext, type Task, type TaskContext } from '@/components/task-provider'

type GeneratedStory = {
  title: string
  intent: string
  acceptance: string[]
  phase: number
  epic: number
  depends_on: string[]
  tags: string[]
}

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
      const data = await api.prd.addStories(version, toAdd)
      setAddedCount(data.added)
      setStep('complete')
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
                    Claude is creating stories based on your description. You&apos;ll be notified when it&apos;s done.
                  </p>
                  <p className="text-xs text-muted-foreground mt-4">
                    You can close this modal - we&apos;ll notify you when complete.
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
