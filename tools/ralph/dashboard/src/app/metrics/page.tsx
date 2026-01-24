import { getMetrics } from '@/lib/data'
import { StatsCard } from '@/components/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Coins, Clock, Hash, TrendingUp } from 'lucide-react'

export const revalidate = 5

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

export default async function MetricsPage() {
  const metrics = await getMetrics()

  if (!metrics || metrics.stories_completed === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Metrics</h1>
        <p className="text-muted-foreground">
          No metrics recorded yet. Complete some stories to see data here.
        </p>
      </div>
    )
  }

  const avgTokens = Math.round(metrics.total_tokens / metrics.stories_completed)
  const avgDuration = Math.round(metrics.total_duration_seconds / metrics.stories_completed)

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Metrics</h1>
        <p className="text-muted-foreground">Token usage and timing data</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Tokens"
          value={formatTokens(metrics.total_tokens)}
          description={`${formatTokens(metrics.total_input_tokens)} in / ${formatTokens(metrics.total_output_tokens)} out`}
          icon={<Coins className="h-4 w-4" />}
        />
        <StatsCard
          title="Total Time"
          value={formatDuration(metrics.total_duration_seconds)}
          description={`${metrics.stories_completed} stories`}
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
                <TableHead>Timestamp</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Input</TableHead>
                <TableHead className="text-right">Output</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.stories.slice().reverse().map((story, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono">{story.story_id}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(story.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">{formatDuration(story.duration_seconds)}</TableCell>
                  <TableCell className="text-right">{formatTokens(story.input_tokens)}</TableCell>
                  <TableCell className="text-right">{formatTokens(story.output_tokens)}</TableCell>
                  <TableCell className="text-right font-medium">{formatTokens(story.total_tokens)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
