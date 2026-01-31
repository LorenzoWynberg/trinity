'use client'

import { useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { StoryCard } from '@/components/story-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PRD, Story, StoryStatus } from '@/lib/types'
import { ChevronDown, ChevronRight } from 'lucide-react'

type VersionMetadata = {
  version: string
  title?: string
  shortTitle?: string
  description?: string
}

type StoriesListProps = {
  prd: PRD
  currentStoryId: string | null
  versions: string[]
  currentVersion: string
  versionMetadata?: VersionMetadata[]
  initialPhase?: string
}

// Loading skeleton for stories list
function StoriesListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filter skeletons */}
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-4 w-8 bg-muted animate-pulse rounded" />
          <div className="h-9 w-[160px] bg-muted animate-pulse rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-12 bg-muted animate-pulse rounded" />
          <div className="h-9 w-[200px] bg-muted animate-pulse rounded-md" />
        </div>
      </div>
      {/* Tabs skeleton */}
      <div className="h-10 w-full max-w-xl bg-muted animate-pulse rounded-md" />
      {/* Content skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}

// Wrapper with Suspense to avoid hydration mismatch from useSearchParams + Radix Select
export function StoriesList(props: StoriesListProps) {
  return (
    <Suspense fallback={<StoriesListSkeleton />}>
      <StoriesListInner {...props} />
    </Suspense>
  )
}

function getStoryStatus(story: Story, currentStoryId: string | null): StoryStatus {
  if (story.skipped) return 'skipped'
  if (story.merged) return 'merged'
  if (story.passes) return 'passed'
  if (story.id === currentStoryId) return 'in_progress'
  return 'pending'
}

function StoriesListInner({ prd, currentStoryId, versions, currentVersion, versionMetadata, initialPhase }: StoriesListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedPhase, setSelectedPhase] = useState<string>(initialPhase || 'all')
  const [selectedEpics, setSelectedEpics] = useState<Record<number, string>>({})
  const [collapsedPhases, setCollapsedPhases] = useState<Set<number>>(new Set())

  const stories = prd.stories

  // Build name lookups
  const phaseNames = useMemo(() => {
    const map = new Map<number, string>()
    if (prd.phases) {
      for (const p of prd.phases) {
        map.set(p.id, p.name)
      }
    }
    return map
  }, [prd.phases])

  const epicNames = useMemo(() => {
    const map = new Map<string, string>()
    if (prd.epics) {
      for (const e of prd.epics) {
        map.set(`${e.phase}-${e.id}`, e.name)
      }
    }
    return map
  }, [prd.epics])

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

  // Handle version change via URL
  const handleVersionChange = (version: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('version', version)
    router.push(`/stories?${params.toString()}`)
  }

  const filteredStories = useMemo(() => {
    let result = stories

    // Stories are already filtered by version server-side

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
  }, [stories, selectedPhase, selectedEpics])

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
        {versions.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium cyber-dark:text-foreground">PRD:</label>
            <Select value={currentVersion} onValueChange={handleVersionChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue>
                  {(() => {
                    const meta = versionMetadata?.find(m => m.version === currentVersion)
                    return meta?.shortTitle ? `${currentVersion} - ${meta.shortTitle}` : currentVersion
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {versions.map(version => {
                  const meta = versionMetadata?.find(m => m.version === version)
                  const label = meta?.shortTitle ? `${version} - ${meta.shortTitle}` : version
                  return (
                    <SelectItem key={version} value={version}>
                      {label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Phase Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium cyber-dark:text-foreground">Phase:</label>
          <Select value={selectedPhase} onValueChange={setSelectedPhase}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All phases" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All phases</SelectItem>
              {phases.map(phase => (
                <SelectItem key={phase} value={phase.toString()}>
                  {phaseNames.get(phase) ? `${phase}. ${phaseNames.get(phase)}` : `Phase ${phase}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="all">
        <div className="overflow-x-auto -mx-2 px-2 pb-2">
          <TabsList className="inline-flex w-max md:w-auto">
            <TabsTrigger value="all">All ({storiesByStatus.all.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({storiesByStatus.pending.length})</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress ({storiesByStatus.in_progress.length})</TabsTrigger>
            <TabsTrigger value="passed">Passed ({storiesByStatus.passed.length})</TabsTrigger>
            <TabsTrigger value="merged">Merged ({storiesByStatus.merged.length})</TabsTrigger>
            <TabsTrigger value="skipped">Skipped ({storiesByStatus.skipped.length})</TabsTrigger>
          </TabsList>
        </div>

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

                  const isCollapsed = collapsedPhases.has(phase)
                  const toggleCollapse = () => {
                    setCollapsedPhases(prev => {
                      const next = new Set(prev)
                      if (next.has(phase)) {
                        next.delete(phase)
                      } else {
                        next.add(phase)
                      }
                      return next
                    })
                  }

                  return (
                    <div key={phase}>
                      <div className="flex items-center gap-4 mb-4">
                        <button
                          onClick={toggleCollapse}
                          className="flex items-center gap-2 hover:text-primary cyber-dark:hover:text-yellow-400 transition-colors cursor-pointer"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                          <h2 className="text-lg font-semibold">
                            {phaseNames.get(phase) ? `Phase ${phase}: ${phaseNames.get(phase)}` : `Phase ${phase}`}
                          </h2>
                          <span className="text-sm text-muted-foreground">
                            ({phaseStories.length})
                          </span>
                        </button>
                        {!isCollapsed && epics.length > 1 && (
                          <Select
                            value={currentEpicFilter}
                            onValueChange={(value) =>
                              setSelectedEpics(prev => ({ ...prev, [phase]: value }))
                            }
                          >
                            <SelectTrigger className="w-[200px] h-8 text-sm">
                              <SelectValue placeholder="All epics" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All epics</SelectItem>
                              {epics.map(epic => {
                                const name = epicNames.get(`${phase}-${epic}`)
                                return (
                                  <SelectItem key={epic} value={epic.toString()}>
                                    {name ? `${epic}. ${name}` : `Epic ${epic}`}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      {!isCollapsed && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {phaseStories.map(story => (
                            <StoryCard
                              key={`${story.target_version}-${story.id}`}
                              story={story}
                              status={getStoryStatus(story, currentStoryId)}
                            />
                          ))}
                        </div>
                      )}
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
