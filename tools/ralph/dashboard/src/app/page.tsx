import { getPRD, getState, getMetrics, getPhaseProgress, getTotalStats, getStoryById, getVersions, getBlockedStories, getUnmergedPassed, getSettings, getVersionsWithMetadata } from '@/lib/data'
import { StatsCard } from '@/components/stats-card'
import { ProgressBar } from '@/components/progress-bar'
import { CurrentWork } from '@/components/current-work'
import { VersionSelector } from '@/components/version-selector'
import { BlockedStories } from '@/components/blocked-stories'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ListTodo, CheckCircle, Coins, Clock } from 'lucide-react'

export const revalidate = 5 // Revalidate every 5 seconds

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`
  }
  return tokens.toString()
}

interface PageProps {
  searchParams: Promise<{ version?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { version: selectedVersion } = await searchParams

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

  const [prd, state, metrics] = await Promise.all([
    getPRD(currentVersion),
    getState(),
    getMetrics()
  ])

  if (!prd) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <p className="text-muted-foreground">
          No PRD found. Make sure prd.json exists in tools/ralph/cli/
        </p>
      </div>
    )
  }

  const stats = getTotalStats(prd, metrics)
  const phases = getPhaseProgress(prd)
  const currentStory = state?.current_story ? getStoryById(prd, state.current_story) : undefined
  const blocked = getBlockedStories(prd)
  const unmergedPassed = getUnmergedPassed(prd)

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{prd.title || 'Dashboard'}</h1>
          <p className="text-muted-foreground">{prd.description || prd.project}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">PRD:</span>
          <VersionSelector versions={versions} currentVersion={currentVersion} versionMetadata={versionMetadata} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Stories"
          value={stats.total}
          description={`${stats.remaining} remaining`}
          icon={<ListTodo className="h-4 w-4" />}
        />
        <StatsCard
          title="Merged"
          value={stats.merged}
          description={`${stats.percentage}% complete`}
          icon={<CheckCircle className="h-4 w-4" />}
        />
        <StatsCard
          title="Tokens Used"
          value={formatTokens(stats.totalTokens)}
          description="Total input + output"
          icon={<Coins className="h-4 w-4" />}
        />
        <StatsCard
          title="Total Time"
          value={formatDuration(stats.totalDuration)}
          description={`${metrics?.stories_passed || 0} passed, ${metrics?.stories_prd || 0} PR'd, ${metrics?.stories_merged || 0} merged`}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Phase Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Phase Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {phases.map((phase) => (
              <ProgressBar
                key={phase.phase}
                label={phase.name ? `${phase.phase}. ${phase.name}` : `Phase ${phase.phase}`}
                value={phase.merged}
                max={phase.total}
              />
            ))}
          </CardContent>
        </Card>

        {/* Current Work */}
        <CurrentWork state={state} story={currentStory} />
      </div>

      {/* Blocked Stories */}
      <BlockedStories blocked={blocked} unmergedPassed={unmergedPassed} />
    </div>
  )
}
