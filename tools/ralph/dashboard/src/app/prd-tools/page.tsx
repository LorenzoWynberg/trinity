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
import { Loader2, Sparkles, CheckCircle, AlertCircle, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Refinement = {
  id: string
  status: 'ok' | 'needs_work'
  issues: string[]
  suggested_acceptance: string[]
  suggested_split?: { title: string; acceptance: string[] }[]
  suggested_tags?: string[]
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

export default function PrdToolsPage() {
  const [versions, setVersions] = useState<string[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refine state
  const [refinements, setRefinements] = useState<Refinement[]>([])
  const [refineSummary, setRefineSummary] = useState<string>('')
  const [selectedRefinements, setSelectedRefinements] = useState<Set<string>>(new Set())

  // Generate state
  const [description, setDescription] = useState('')
  const [generatedStories, setGeneratedStories] = useState<GeneratedStory[]>([])
  const [generateReasoning, setGenerateReasoning] = useState<string>('')
  const [selectedStories, setSelectedStories] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetch('/api/versions')
      .then(res => res.json())
      .then(data => {
        setVersions(data.versions || [])
        if (data.versions?.length > 0) {
          setSelectedVersion(data.versions[0])
        }
      })
      .catch(() => {})
  }, [])

  const handleRefine = async () => {
    if (!selectedVersion) return
    setLoading(true)
    setError(null)
    setRefinements([])
    setRefineSummary('')

    try {
      const res = await fetch('/api/prd/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: selectedVersion })
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setRefinements(data.refinements || [])
        setRefineSummary(data.summary || '')
        // Pre-select all that need work
        const needsWork = new Set(
          (data.refinements || [])
            .filter((r: Refinement) => r.status === 'needs_work')
            .map((r: Refinement) => r.id)
        )
        setSelectedRefinements(needsWork)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyRefinements = async () => {
    if (selectedRefinements.size === 0) return
    setLoading(true)
    setError(null)

    const toApply = refinements.filter(r => selectedRefinements.has(r.id))

    try {
      const res = await fetch('/api/prd/refine', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: selectedVersion, refinements: toApply })
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setRefinements([])
        setRefineSummary(`Applied ${data.applied} refinements`)
        setSelectedRefinements(new Set())
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!selectedVersion || !description.trim()) return
    setLoading(true)
    setError(null)
    setGeneratedStories([])
    setGenerateReasoning('')

    try {
      const res = await fetch('/api/prd/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: selectedVersion, description })
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setGeneratedStories(data.stories || [])
        setGenerateReasoning(data.reasoning || '')
        // Pre-select all
        setSelectedStories(new Set((data.stories || []).map((_: any, i: number) => i)))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyStories = async () => {
    if (selectedStories.size === 0) return
    setLoading(true)
    setError(null)

    const toAdd = generatedStories.filter((_, i) => selectedStories.has(i))

    try {
      const res = await fetch('/api/prd/generate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: selectedVersion, stories: toAdd })
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setGeneratedStories([])
        setGenerateReasoning(`Added ${data.added} stories to ${selectedVersion}`)
        setSelectedStories(new Set())
        setDescription('')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleRefinement = (id: string) => {
    setSelectedRefinements(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleStory = (index: number) => {
    setSelectedStories(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">PRD Tools</h1>
        <Select value={selectedVersion} onValueChange={setSelectedVersion}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Version" />
          </SelectTrigger>
          <SelectContent>
            {versions.map(v => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Refine Stories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Refine Stories
          </CardTitle>
          <CardDescription>
            Review pending stories and get suggestions for clearer acceptance criteria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleRefine} disabled={loading || !selectedVersion}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Analyze Stories
          </Button>

          {refineSummary && (
            <p className="text-sm text-muted-foreground">{refineSummary}</p>
          )}

          {refinements.length > 0 && (
            <div className="space-y-3">
              {refinements.map(ref => (
                <div
                  key={ref.id}
                  className={cn(
                    "p-3 rounded-md border cursor-pointer transition-colors",
                    ref.status === 'ok' ? "bg-green-500/10 border-green-500/30" : "bg-amber-500/10 border-amber-500/30",
                    selectedRefinements.has(ref.id) && "ring-2 ring-primary"
                  )}
                  onClick={() => ref.status === 'needs_work' && toggleRefinement(ref.id)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {ref.status === 'ok' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="font-medium">{ref.id}</span>
                    <span className="text-xs text-muted-foreground">
                      {ref.status === 'ok' ? 'Good' : 'Needs work'}
                    </span>
                  </div>

                  {ref.issues && ref.issues.length > 0 && (
                    <div className="text-sm mb-2">
                      <span className="text-muted-foreground">Issues: </span>
                      {ref.issues.join(', ')}
                    </div>
                  )}

                  {ref.suggested_acceptance && ref.suggested_acceptance.length > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Suggested: </span>
                      <ul className="list-disc list-inside mt-1">
                        {ref.suggested_acceptance.map((a, i) => (
                          <li key={i} className="text-xs">{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}

              {refinements.some(r => r.status === 'needs_work') && (
                <Button
                  onClick={handleApplyRefinements}
                  disabled={loading || selectedRefinements.size === 0}
                  className="w-full"
                >
                  Apply {selectedRefinements.size} Refinements
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Stories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Generate Stories
          </CardTitle>
          <CardDescription>
            Describe what you want to build and Claude will generate PRD stories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Describe the feature you want to add... e.g., 'Add user authentication with OAuth support for Google and GitHub'"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
          />

          <Button onClick={handleGenerate} disabled={loading || !selectedVersion || !description.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Generate Stories
          </Button>

          {generateReasoning && (
            <p className="text-sm text-muted-foreground">{generateReasoning}</p>
          )}

          {generatedStories.length > 0 && (
            <div className="space-y-3">
              {generatedStories.map((story, i) => (
                <div
                  key={i}
                  className={cn(
                    "p-3 rounded-md border cursor-pointer transition-colors bg-muted/50",
                    selectedStories.has(i) && "ring-2 ring-primary"
                  )}
                  onClick={() => toggleStory(i)}
                >
                  <div className="font-medium mb-1">{story.title}</div>
                  <div className="text-xs text-muted-foreground mb-2">
                    Phase {story.phase} / Epic {story.epic}
                    {story.tags?.length > 0 && ` · ${story.tags.join(', ')}`}
                  </div>
                  {story.intent && (
                    <div className="text-sm mb-2">{story.intent}</div>
                  )}
                  <ul className="list-disc list-inside">
                    {story.acceptance?.map((a, j) => (
                      <li key={j} className="text-xs">{a}</li>
                    ))}
                  </ul>
                </div>
              ))}

              <Button
                onClick={handleApplyStories}
                disabled={loading || selectedStories.size === 0}
                className="w-full"
              >
                Add {selectedStories.size} Stories to PRD
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
