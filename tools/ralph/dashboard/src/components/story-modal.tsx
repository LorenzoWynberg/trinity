'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, GitBranch, CheckCircle2, Circle } from 'lucide-react'
import Link from 'next/link'
import type { Story, StoryStatus } from '@/lib/types'

const statusConfig: Record<StoryStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-500' },
  in_progress: { label: 'In Progress', className: 'bg-blue-500' },
  passed: { label: 'Passed', className: 'bg-yellow-500' },
  merged: { label: 'Merged', className: 'bg-green-500' },
  skipped: { label: 'Skipped', className: 'bg-purple-500' },
  blocked: { label: 'Blocked', className: 'bg-red-500' },
}

type StoryModalProps = {
  story: Story | null
  status: StoryStatus
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StoryModal({ story, status, open, onOpenChange }: StoryModalProps) {
  if (!story) return null

  const config = statusConfig[status]
  const branchName = `feat/story-${story.phase}.${story.epic}.${story.story_number}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="font-mono">{story.id}</DialogTitle>
            <Badge className={config.className}>{config.label}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="font-medium">{story.title}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <span>Phase {story.phase}</span>
              <span>·</span>
              <span>Epic {story.epic}</span>
            </div>
          </div>

          {story.intent && (
            <div>
              <h4 className="text-sm font-medium mb-1">Intent</h4>
              <p className="text-sm text-muted-foreground">{story.intent}</p>
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium mb-2">Acceptance Criteria</h4>
            <ul className="space-y-1">
              {story.acceptance.map((ac, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {story.merged ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <span>{ac}</span>
                </li>
              ))}
            </ul>
          </div>

          {story.depends_on && story.depends_on.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">Dependencies</h4>
              <div className="flex flex-wrap gap-1">
                {story.depends_on.map(dep => (
                  <Badge key={dep} variant="outline" className="font-mono text-xs">
                    {dep}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GitBranch className="h-4 w-4" />
            <code className="text-xs">{branchName}</code>
          </div>

          {(story.pr_url || story.merge_commit) && (
            <div className="flex items-center gap-4 text-sm">
              {story.pr_url && (
                <a
                  href={story.pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  PR #{story.pr_url.split('/').pop()}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {story.merge_commit && (
                <a
                  href={`https://github.com/trinity-ai-labs/trinity/commit/${story.merge_commit}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <code className="text-xs">{story.merge_commit.slice(0, 8)}</code>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <Link href={`/stories/${story.id}`}>
              <Button variant="outline" size="sm">
                View Full Details
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
