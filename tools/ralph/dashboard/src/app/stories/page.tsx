import { getPRD, getState, getVersions } from '@/lib/data'
import { StoriesList } from '@/components/stories-list'

export const revalidate = 5

interface PageProps {
  searchParams: Promise<{ version?: string }>
}

export default async function StoriesPage({ searchParams }: PageProps) {
  const { version: selectedVersion } = await searchParams
  const currentVersion = selectedVersion || 'all'

  const [prd, state, versions] = await Promise.all([
    getPRD(currentVersion),
    getState(),
    getVersions()
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
  const versionCount = [...new Set(prd.stories.map(s => s.target_version))].length

  // Build description based on whether viewing all versions or single version
  const description = currentVersion === 'all'
    ? `${prd.stories.length} stories across ${versionCount} versions`
    : `${prd.stories.length} stories across ${phases.length} phases`

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stories</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <StoriesList stories={prd.stories} currentStoryId={currentStoryId} versions={versions} currentVersion={currentVersion} />
    </div>
  )
}
