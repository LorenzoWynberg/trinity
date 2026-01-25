import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Story, StoryStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

interface StoryCardProps {
  story: Story
  status: StoryStatus
}

const statusConfig: Record<StoryStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-500' },
  in_progress: { label: 'In Progress', className: 'bg-blue-500' },
  passed: { label: 'Passed', className: 'bg-yellow-500' },
  merged: { label: 'Merged', className: 'bg-green-500' },
  skipped: { label: 'Skipped', className: 'bg-purple-500' },
  blocked: { label: 'Blocked', className: 'bg-red-500' },
}

export function StoryCard({ story, status }: StoryCardProps) {
  const config = statusConfig[status]

  return (
    <Link href={`/stories/${story.id}`}>
      <Card className="hover:border-primary transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-mono">Story {story.id}</CardTitle>
            <Badge className={cn('text-xs', config.className)}>{config.label}</Badge>
          </div>
          <p className="text-sm font-medium leading-snug">{story.title}</p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <span>
                {story.phase_name || `Phase ${story.phase}`} • {story.epic_name || `Epic ${story.epic}`}
              </span>
              {story.target_version && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {story.target_version}
                </Badge>
              )}
            </div>
            {story.depends_on && story.depends_on.length > 0 && (
              <div>
                Deps: {story.depends_on.join(', ')}
              </div>
            )}
          </div>
          {story.acceptance && story.acceptance.length > 0 && (
            <ul className="mt-2 text-xs text-muted-foreground space-y-0.5">
              {story.acceptance.slice(0, 3).map((ac, i) => (
                <li key={i} className="truncate">• {ac}</li>
              ))}
              {story.acceptance.length > 3 && (
                <li className="text-muted-foreground/50">+{story.acceptance.length - 3} more</li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
