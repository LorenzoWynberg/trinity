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
import { Sparkles, Wand2, AlertCircle } from 'lucide-react'
import { useTaskContext } from '@/components/task-provider'

// Refine Stories Modal - Simple trigger for background task
type RefineModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: string
}

export function RefineStoriesModal({ open, onOpenChange, version }: RefineModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const { createTask, isTaskRunning } = useTaskContext()

  const isRunning = isTaskRunning('refine')

  const handleStart = async () => {
    setStarting(true)
    setError(null)

    try {
      await createTask('refine', version)
      onOpenChange(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setStarting(false)
    }
  }

  const handleClose = () => {
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Refine Stories ({version})
          </DialogTitle>
          <DialogDescription className="cyber-dark:text-secondary-foreground">
            Analyze pending stories for clarity issues
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-center gap-2 text-sm mb-4">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {isRunning ? (
            <p className="text-sm text-muted-foreground">
              A refine task is already running. You'll be notified when it completes.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Claude will analyze all pending stories in {version} and suggest improvements for unclear acceptance criteria.
              This runs in the background — you'll get a notification when it's done.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleStart} disabled={starting || isRunning}>
            <Sparkles className="h-4 w-4" />
            {starting ? 'Starting...' : 'Start Analysis'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Generate Stories Modal - Simple trigger for background task
type GenerateModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: string
}

export function GenerateStoriesModal({ open, onOpenChange, version }: GenerateModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [starting, setStarting] = useState(false)
  const { createTask, isTaskRunning } = useTaskContext()

  const isRunning = isTaskRunning('generate')

  const handleStart = async () => {
    if (!description.trim()) return
    setStarting(true)
    setError(null)

    try {
      await createTask('generate', version, { description })
      setDescription('')
      onOpenChange(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setStarting(false)
    }
  }

  const handleClose = () => {
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Generate Stories ({version})
          </DialogTitle>
          <DialogDescription className="cyber-dark:text-secondary-foreground">
            Describe what you want to build
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {isRunning ? (
            <p className="text-sm text-muted-foreground">
              A generate task is already running. You'll be notified when it completes.
            </p>
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
                This runs in the background — you'll get a notification when it's done.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleStart} disabled={starting || isRunning || !description.trim()}>
            <Wand2 className="h-4 w-4" />
            {starting ? 'Starting...' : 'Generate Stories'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
