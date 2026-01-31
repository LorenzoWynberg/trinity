import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, GitPullRequest, Clock } from 'lucide-react'
import type { BlockedInfo, Story } from '@/lib/types'

interface BlockedStoriesProps {
  blocked: BlockedInfo[]
  unmergedPassed: Story[]
}

export function BlockedStories({ blocked, unmergedPassed }: BlockedStoriesProps) {
  const hasBlocked = blocked.length > 0
  const hasUnmerged = unmergedPassed.length > 0

  if (!hasBlocked && !hasUnmerged) {
    return null
  }

  return (
    <Card className="border-yellow-500/50 cyber-light:border-yellow-400">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-yellow-500">
          <AlertCircle className="h-5 w-5" />
          Blocked
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Unmerged PRs */}
        {hasUnmerged && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <GitPullRequest className="h-4 w-4" />
              Awaiting Merge ({unmergedPassed.length})
            </h4>
            <div className="space-y-2">
              {unmergedPassed.map(story => (
                <div key={story.id} className="text-sm flex items-center justify-between">
                  <Link href={`/stories/${encodeURIComponent(story.id)}`} className="hover:underline">
                    <span className="font-mono text-muted-foreground">{story.id}</span>
                    <span className="ml-2">{story.title}</span>
                  </Link>
                  {story.pr_url ? (
                    <a
                      href={story.pr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline"
                    >
                      PR
                    </a>
                  ) : (
                    <Badge variant="outline" className="text-xs">No PR</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Blocked Stories */}
        {hasBlocked && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Waiting on Dependencies ({blocked.length})
            </h4>
            <div className="space-y-2">
              {blocked.map(({ story, blockedBy, blockerStory }) => (
                <div key={story.id} className="text-sm">
                  <Link href={`/stories/${encodeURIComponent(story.id)}`} className="hover:underline">
                    <span className="font-mono text-muted-foreground">{story.id}</span>
                    <span className="ml-2">{story.title}</span>
                  </Link>
                  <div className="text-xs text-muted-foreground ml-4">
                    → waiting on{' '}
                    {blockerStory ? (
                      <Link href={`/stories/${encodeURIComponent(blockerStory.id)}`} className="text-yellow-500 hover:underline">
                        {blockerStory.id}
                      </Link>
                    ) : (
                      <span className="text-yellow-500">{blockedBy}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
