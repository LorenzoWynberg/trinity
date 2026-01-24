import { getPRD, getState } from '@/lib/data'
import { StoriesList } from '@/components/stories-list'

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
  const phases = [...new Set(prd.stories.map(s => s.phase))].sort((a, b) => a - b)

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stories</h1>
        <p className="text-muted-foreground">
          {prd.stories.length} stories across {phases.length} phases
        </p>
      </div>

      <StoriesList stories={prd.stories} currentStoryId={currentStoryId} />
    </div>
  )
}
