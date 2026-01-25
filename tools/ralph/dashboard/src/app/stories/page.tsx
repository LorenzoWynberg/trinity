import { getPRD, getState, getVersions, getSettings } from '@/lib/data'
import { StoriesList } from '@/components/stories-list'

export const revalidate = 5

interface PageProps {
  searchParams: Promise<{ version?: string }>
}

export default async function StoriesPage({ searchParams }: PageProps) {
  const { version: selectedVersion } = await searchParams

  const [settings, versions] = await Promise.all([
    getSettings(),
    getVersions()
  ])

  // Resolve the current version: URL param > settings default > first available
  let currentVersion: string
  if (selectedVersion && versions.includes(selectedVersion)) {
    currentVersion = selectedVersion
  } else if (settings.defaultVersion !== 'first' && versions.includes(settings.defaultVersion)) {
    currentVersion = settings.defaultVersion
  } else {
    currentVersion = versions.length > 0 ? versions[0] : 'v0.1'
  }

  const [prd, state] = await Promise.all([
    getPRD(currentVersion),
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

  const description = `${prd.stories.length} stories across ${phases.length} phases`

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stories</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <StoriesList prd={prd} currentStoryId={currentStoryId} versions={versions} currentVersion={currentVersion} />
    </div>
  )
}
