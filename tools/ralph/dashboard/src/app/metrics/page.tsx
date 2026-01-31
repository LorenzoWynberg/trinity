'use client'

import { useEffect, useState } from 'react'
import { StatsCard } from '@/components/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Coins, Clock, Hash, TrendingUp, CheckCircle, GitPullRequest, GitMerge } from 'lucide-react'
import { api } from '@/lib/api'
import type { Metrics, Story } from '@/lib/types'

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`
  }
  return `${secs}s`
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`
  }
  return tokens.toString()
}

// Extract version from story ID (e.g., STORY-1.2.3 -> check prd data)
function getVersionFromStoryId(storyId: string, stories: Story[]): string | undefined {
  const story = stories.find(s => s.id === storyId)
  return story?.target_version
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [versions, setVersions] = useState<string[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [metricsData, prdData, versionsData] = await Promise.all([
          api.metrics.get(),
          api.prd.get(),
          api.prd.getVersions(),
        ])

        setMetrics(metricsData)
        setStories(prdData?.stories || [])
        setVersions(versionsData.versions || [])
        setLoading(false)
      } catch (error) {
        console.error('Failed to fetch metrics:', error)
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 cyber-light:text-pink-600 cyber-dark:text-foreground">Metrics</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!metrics || metrics.stories.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 cyber-light:text-pink-600 cyber-dark:text-foreground">Metrics</h1>
        <p className="text-muted-foreground">
          No metrics recorded yet. Complete some stories to see data here.
        </p>
      </div>
    )
  }

  // Filter metrics by version
  const filteredMetricStories = selectedVersion === 'all'
    ? metrics.stories
    : metrics.stories.filter(m => {
        const version = getVersionFromStoryId(m.story_id, stories)
        return version === selectedVersion
      })

  // Calculate filtered totals
  const filteredTotals = filteredMetricStories.reduce(
    (acc, m) => ({
      tokens: acc.tokens + m.total_tokens,
      input: acc.input + m.input_tokens,
      output: acc.output + m.output_tokens,
      duration: acc.duration + m.duration_seconds,
      count: acc.count + 1,
    }),
    { tokens: 0, input: 0, output: 0, duration: 0, count: 0 }
  )

  const avgTokens = filteredTotals.count > 0 ? Math.round(filteredTotals.tokens / filteredTotals.count) : 0
  const avgDuration = filteredTotals.count > 0 ? Math.round(filteredTotals.duration / filteredTotals.count) : 0

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold cyber-light:text-pink-600 cyber-dark:text-foreground">Metrics</h1>
          <p className="text-muted-foreground cyber-light:text-cyan-600 cyber-dark:text-secondary-foreground">Token usage and timing data</p>
        </div>

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
      </div>

      {/* Story Pipeline Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Stories Passed"
          value={metrics.stories_passed || 0}
          description="Claude finished work"
          icon={<CheckCircle className="h-4 w-4" />}
        />
        <StatsCard
          title="PRs Created"
          value={metrics.stories_prd || 0}
          description="Pull requests opened"
          icon={<GitPullRequest className="h-4 w-4" />}
        />
        <StatsCard
          title="Stories Merged"
          value={metrics.stories_merged || 0}
          description="PRs merged to base"
          icon={<GitMerge className="h-4 w-4" />}
        />
      </div>

      {/* Token & Time Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Tokens"
          value={formatTokens(filteredTotals.tokens)}
          description={`${formatTokens(filteredTotals.input)} in / ${formatTokens(filteredTotals.output)} out`}
          icon={<Coins className="h-4 w-4" />}
        />
        <StatsCard
          title="Total Time"
          value={formatDuration(filteredTotals.duration)}
          description={`${filteredTotals.count} stories recorded`}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatsCard
          title="Avg Tokens/Story"
          value={formatTokens(avgTokens)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatsCard
          title="Avg Time/Story"
          value={formatDuration(avgDuration)}
          icon={<Hash className="h-4 w-4" />}
        />
      </div>

      {/* Story Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Story Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Story</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Input</TableHead>
                <TableHead className="text-right">Output</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMetricStories.slice().reverse().map((story, i) => {
                const version = getVersionFromStoryId(story.story_id, stories)
                return (
                  <TableRow key={i}>
                    <TableCell className="font-mono">{story.story_id}</TableCell>
                    <TableCell className="text-muted-foreground">{version || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(story.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{formatDuration(story.duration_seconds)}</TableCell>
                    <TableCell className="text-right">{formatTokens(story.input_tokens)}</TableCell>
                    <TableCell className="text-right">{formatTokens(story.output_tokens)}</TableCell>
                    <TableCell className="text-right font-medium">{formatTokens(story.total_tokens)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
