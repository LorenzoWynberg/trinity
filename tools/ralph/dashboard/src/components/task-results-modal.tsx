'use client'

import { useState } from 'react'
import { useTaskContext, type Task } from './task-provider'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, XCircle, Sparkles, Wand2, Pencil, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

function getTaskIcon(type: Task['type']) {
  switch (type) {
    case 'refine': return Sparkles
    case 'generate': return Wand2
    case 'story-edit': return Pencil
  }
}

function getTaskLabel(type: Task['type']) {
  switch (type) {
    case 'refine': return 'Refine Stories'
    case 'generate': return 'Generate Stories'
    case 'story-edit': return 'Story Edit'
  }
}

export function TaskResultsModal() {
  const { selectedTask, setSelectedTask } = useTaskContext()
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  if (!selectedTask) return null

  const Icon = getTaskIcon(selectedTask.type)
  const isComplete = selectedTask.status === 'complete'
  const result = selectedTask.result

  const handleClose = () => {
    setSelectedTask(null)
    setSelectedIds(new Set())
    setApplied(false)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleApplyRefinements = async () => {
    if (!result?.refinements) return
    setApplying(true)

    try {
      const selected = result.refinements.filter((r: any) => selectedIds.has(r.id))
      const res = await fetch('/api/prd/refine', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: selectedTask.version,
          refinements: selected
        })
      })

      if (res.ok) {
        setApplied(true)
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to apply:', error)
    } finally {
      setApplying(false)
    }
  }

  const handleAddStories = async () => {
    if (!result?.stories) return
    setApplying(true)

    try {
      const selected = result.stories.filter((_: any, i: number) => selectedIds.has(i.toString()))
      const res = await fetch('/api/prd/generate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: selectedTask.version,
          stories: selected
        })
      })

      if (res.ok) {
        setApplied(true)
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to add:', error)
    } finally {
      setApplying(false)
    }
  }

  // Initialize selection for refine results
  const initializeRefineSelection = () => {
    if (result?.refinements && selectedIds.size === 0) {
      const needsWork = result.refinements
        .filter((r: any) => r.status === 'needs_work')
        .map((r: any) => r.id)
      setSelectedIds(new Set(needsWork))
    }
  }

  // Initialize selection for generate results
  const initializeGenerateSelection = () => {
    if (result?.stories && selectedIds.size === 0) {
      const indices = result.stories.map((_: any, i: number) => i.toString())
      setSelectedIds(new Set(indices))
    }
  }

  return (
    <Dialog open={!!selectedTask} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="md:!max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {getTaskLabel(selectedTask.type)} Results
          </DialogTitle>
          <DialogDescription className="cyber-dark:text-secondary-foreground">
            {isComplete ? (
              selectedTask.type === 'refine' ? result?.summary :
              selectedTask.type === 'generate' ? result?.reasoning :
              'Analysis complete'
            ) : (
              `Error: ${selectedTask.error}`
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {!isComplete ? (
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <p className="text-lg font-medium">Task Failed</p>
              <p className="text-muted-foreground">{selectedTask.error}</p>
            </div>
          ) : applied ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">Changes Applied!</p>
            </div>
          ) : selectedTask.type === 'refine' && result?.refinements ? (
            <div className="space-y-3" onMouseEnter={initializeRefineSelection}>
              {result.refinements.filter((r: any) => r.status === 'needs_work').length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-lg font-medium">All stories look good!</p>
                </div>
              ) : (
                result.refinements
                  .filter((r: any) => r.status === 'needs_work')
                  .map((ref: any) => (
                    <div
                      key={ref.id}
                      onClick={() => toggleSelect(ref.id)}
                      className={cn(
                        "p-3 rounded-md border cursor-pointer transition-all",
                        selectedIds.has(ref.id) && "ring-2 ring-primary cyber-dark:ring-accent"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono font-medium">{ref.id}</span>
                          <span className="text-muted-foreground ml-2">— {ref.title}</span>
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center",
                          selectedIds.has(ref.id) ? "bg-primary border-primary cyber-dark:bg-accent cyber-dark:border-accent" : "border-muted-foreground"
                        )}>
                          {selectedIds.has(ref.id) && <Check className="h-3 w-3 text-primary-foreground cyber-dark:text-accent-foreground" />}
                        </div>
                      </div>
                      {ref.issues.length > 0 && (
                        <p className="text-xs text-amber-600 mt-1">{ref.issues.join(', ')}</p>
                      )}
                    </div>
                  ))
              )}
            </div>
          ) : selectedTask.type === 'generate' && result?.stories ? (
            <div className="space-y-3" onMouseEnter={initializeGenerateSelection}>
              {result.stories.map((story: any, i: number) => (
                <div
                  key={i}
                  onClick={() => toggleSelect(i.toString())}
                  className={cn(
                    "p-3 rounded-md border cursor-pointer transition-all",
                    selectedIds.has(i.toString()) && "ring-2 ring-primary cyber-dark:ring-accent"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{story.title}</span>
                      <div className="flex gap-1 mt-1">
                        <Badge variant="outline" className="text-xs">Phase {story.phase}</Badge>
                        <Badge variant="outline" className="text-xs">Epic {story.epic}</Badge>
                      </div>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center",
                      selectedIds.has(i.toString()) ? "bg-primary border-primary cyber-dark:bg-accent cyber-dark:border-accent" : "border-muted-foreground"
                    )}>
                      {selectedIds.has(i.toString()) && <Check className="h-3 w-3 text-primary-foreground cyber-dark:text-accent-foreground" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <pre className="text-xs bg-muted p-4 rounded overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>

        <DialogFooter>
          {applied ? (
            <Button onClick={handleClose}>Done</Button>
          ) : isComplete && selectedTask.type === 'refine' && result?.refinements?.some((r: any) => r.status === 'needs_work') ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleApplyRefinements} disabled={applying || selectedIds.size === 0}>
                {applying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Apply {selectedIds.size} Refinements
              </Button>
            </>
          ) : isComplete && selectedTask.type === 'generate' && result?.stories?.length > 0 ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleAddStories} disabled={applying || selectedIds.size === 0}>
                {applying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Add {selectedIds.size} Stories
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
