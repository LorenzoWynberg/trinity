import { getPRD, getState } from '@/lib/data'
import { getStoryStatus } from '@/lib/types'
import { StoryCard } from '@/components/story-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const revalidate = 5

export default async function StoriesPage() {
  const [prd, state] = await Promise.all([
    getPRD(),
    getState()
  ])

  if (!prd) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Stories</h1>
        <p className="text-muted-foreground">No PRD found.</p>
      </div>
    )
  }

  const currentStoryId = state?.current_story || null

  // Group stories by status
  const storiesByStatus = {
    all: prd.stories,
    pending: prd.stories.filter(s => getStoryStatus(s, currentStoryId) === 'pending'),
    in_progress: prd.stories.filter(s => getStoryStatus(s, currentStoryId) === 'in_progress'),
    passed: prd.stories.filter(s => getStoryStatus(s, currentStoryId) === 'passed'),
    merged: prd.stories.filter(s => getStoryStatus(s, currentStoryId) === 'merged'),
    skipped: prd.stories.filter(s => getStoryStatus(s, currentStoryId) === 'skipped'),
  }

  // Group by phase
  const phases = [...new Set(prd.stories.map(s => s.phase))].sort((a, b) => a - b)

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stories</h1>
        <p className="text-muted-foreground">
          {prd.stories.length} stories across {phases.length} phases
        </p>
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

        {Object.entries(storiesByStatus).map(([status, stories]) => (
          <TabsContent key={status} value={status} className="mt-6">
            {stories.length === 0 ? (
              <p className="text-muted-foreground">No stories in this category.</p>
            ) : (
              <div className="space-y-8">
                {phases.map(phase => {
                  const phaseStories = stories.filter(s => s.phase === phase)
                  if (phaseStories.length === 0) return null

                  return (
                    <div key={phase}>
                      <h2 className="text-lg font-semibold mb-4">Phase {phase}</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {phaseStories.map(story => (
                          <StoryCard
                            key={story.id}
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
