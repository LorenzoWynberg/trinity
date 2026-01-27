import { getPRD, getState, getVersions, getSettings, getVersionsWithMetadata } from '@/lib/data'
import { StoriesList } from '@/components/stories-list'
import { StoriesHeader } from '@/components/stories-header'

export const revalidate = 5

interface PageProps {
  searchParams: Promise<{ version?: string; phase?: string }>
}

export default async function StoriesPage({ searchParams }: PageProps) {
  const { version: selectedVersion, phase: selectedPhase } = await searchParams

  const [settings, versions, versionMetadata] = await Promise.all([
    getSettings(),
    getVersions(),
    getVersionsWithMetadata()
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
        <h1 className="text-2xl font-bold mb-4 cyber-light:text-pink-600 cyber-dark:text-cyan-400">Stories</h1>
        <p className="text-muted-foreground">No PRD found.</p>
      </div>
    )
  }

  const currentStoryId = state?.current_story || null
  const phases = [...new Set(prd.stories.map(s => s.phase))].sort((a, b) => a - b)

  return (
    <div className="p-8 space-y-6">
      <StoriesHeader
        totalStories={prd.stories.length}
        phaseCount={phases.length}
        version={currentVersion}
      />

      <StoriesList prd={prd} currentStoryId={currentStoryId} versions={versions} currentVersion={currentVersion} versionMetadata={versionMetadata} initialPhase={selectedPhase} />
    </div>
  )
}
