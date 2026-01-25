'use client'

import { useState, useMemo } from 'react'
import { StoryCard } from '@/components/story-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Story, StoryStatus } from '@/lib/types'

type StoriesListProps = {
  stories: Story[]
  currentStoryId: string | null
  versions: string[]
}

function getStoryStatus(story: Story, currentStoryId: string | null): StoryStatus {
  if (story.skipped) return 'skipped'
  if (story.merged) return 'merged'
  if (story.passes) return 'passed'
  if (story.id === currentStoryId) return 'in_progress'
  return 'pending'
}

export function StoriesList({ stories, currentStoryId, versions }: StoriesListProps) {
  const [selectedVersion, setSelectedVersion] = useState<string>('all')
  const [selectedPhase, setSelectedPhase] = useState<string>('all')
  const [selectedEpics, setSelectedEpics] = useState<Record<number, string>>({})

  // Get unique phases and epics
  const phases = useMemo(() =>
    [...new Set(stories.map(s => s.phase))].sort((a, b) => a - b),
    [stories]
  )

  const epicsByPhase = useMemo(() => {
    const result: Record<number, number[]> = {}
    phases.forEach(phase => {
      const phaseStories = stories.filter(s => s.phase === phase)
      result[phase] = [...new Set(phaseStories.map(s => s.epic))].sort((a, b) => a - b)
    })
    return result
  }, [stories, phases])

  // Filter stories based on selections
  const filteredStories = useMemo(() => {
    let result = stories

    // Filter by version
    if (selectedVersion !== 'all') {
      result = result.filter(s => s.target_version === selectedVersion)
    }

    // Filter by phase
    if (selectedPhase !== 'all') {
      result = result.filter(s => s.phase === parseInt(selectedPhase))
    }

    // Filter by epic (per phase)
    result = result.filter(story => {
      const epicFilter = selectedEpics[story.phase]
      if (!epicFilter || epicFilter === 'all') return true
      return story.epic === parseInt(epicFilter)
    })

    return result
  }, [stories, selectedVersion, selectedPhase, selectedEpics])

  // Group filtered stories by status
  const storiesByStatus = useMemo(() => ({
    all: filteredStories,
    pending: filteredStories.filter(s => getStoryStatus(s, currentStoryId) === 'pending'),
    in_progress: filteredStories.filter(s => getStoryStatus(s, currentStoryId) === 'in_progress'),
    passed: filteredStories.filter(s => getStoryStatus(s, currentStoryId) === 'passed'),
    merged: filteredStories.filter(s => getStoryStatus(s, currentStoryId) === 'merged'),
    skipped: filteredStories.filter(s => getStoryStatus(s, currentStoryId) === 'skipped'),
  }), [filteredStories, currentStoryId])

  // Get phases to display (all or just selected)
  const displayPhases = selectedPhase === 'all' ? phases : [parseInt(selectedPhase)]

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-6 flex-wrap">
        {/* Version Filter */}
        {versions.length >= 1 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Version:</label>
            <Select value={selectedVersion} onValueChange={setSelectedVersion}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="All versions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All versions</SelectItem>
                {versions.map(version => (
                  <SelectItem key={version} value={version}>
                    {version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Phase Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Phase:</label>
          <Select value={selectedPhase} onValueChange={setSelectedPhase}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All phases" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All phases</SelectItem>
              {phases.map(phase => (
                <SelectItem key={phase} value={phase.toString()}>
                  Phase {phase}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({storiesByStatus.all.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({storiesByStatus.pending.length})</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress ({storiesByStatus.in_progress.length})</TabsTrigger>
          <TabsTrigger value="passed">Passed ({storiesByStatus.passed.length})</TabsTrigger>
          <TabsTrigger value="merged">Merged ({storiesByStatus.merged.length})</TabsTrigger>
          <TabsTrigger value="skipped">Skipped ({storiesByStatus.skipped.length})</TabsTrigger>
        </TabsList>

        {Object.entries(storiesByStatus).map(([status, statusStories]) => (
          <TabsContent key={status} value={status} className="mt-6">
            {statusStories.length === 0 ? (
              <p className="text-muted-foreground">No stories match the current filters.</p>
            ) : (
              <div className="space-y-8">
                {displayPhases.map(phase => {
                  const phaseStories = statusStories.filter(s => s.phase === phase)
                  if (phaseStories.length === 0) return null

                  const epics = epicsByPhase[phase] || []
                  const currentEpicFilter = selectedEpics[phase] || 'all'

                  return (
                    <div key={phase}>
                      <div className="flex items-center gap-4 mb-4">
                        <h2 className="text-lg font-semibold">Phase {phase}</h2>
                        {epics.length > 1 && (
                          <Select
                            value={currentEpicFilter}
                            onValueChange={(value) =>
                              setSelectedEpics(prev => ({ ...prev, [phase]: value }))
                            }
                          >
                            <SelectTrigger className="w-[150px] h-8 text-sm">
                              <SelectValue placeholder="All epics" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All epics</SelectItem>
                              {epics.map(epic => (
                                <SelectItem key={epic} value={epic.toString()}>
                                  Epic {epic}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {phaseStories.map(story => (
                          <StoryCard
                            key={`${story.target_version}-${story.id}`}
                            story={story}
                            status={getStoryStatus(story, currentStoryId)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
