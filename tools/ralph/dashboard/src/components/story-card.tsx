import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Story, StoryStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ArrowUp, Tag } from 'lucide-react';

interface StoryCardProps {
  story: Story;
  status: StoryStatus;
}

const statusConfig: Record<StoryStatus, { label: string; className: string }> =
  {
    pending: { label: 'Pending', className: 'bg-gray-500' },
    in_progress: { label: 'In Progress', className: 'bg-blue-500' },
    passed: { label: 'Passed', className: 'bg-yellow-500' },
    merged: { label: 'Merged', className: 'bg-green-500' },
    skipped: { label: 'Skipped', className: 'bg-purple-500' },
    blocked: { label: 'Blocked', className: 'bg-red-500' },
  };

export function StoryCard({ story, status }: StoryCardProps) {
  const config = statusConfig[status];

  return (
    <Link href={`/stories/${story.id}`}>
      <Card className="hover:border-primary transition-colors cursor-pointer h-full cyber-light:border-l-4 cyber-light:border-l-cyan-400 cyber-dark:hover:border-yellow-400">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-mono cyber-light:text-pink-600 cyber-dark:text-foreground">
                Story {story.id}
              </CardTitle>
              {story.priority && story.priority > 0 && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5 text-orange-500 border-orange-500/50">
                  <ArrowUp className="h-2.5 w-2.5" />
                  {story.priority}
                </Badge>
              )}
            </div>
            <Badge className={cn('text-xs', config.className)}>
              {config.label}
            </Badge>
          </div>
          <p className="text-sm font-medium leading-snug cyber-dark:text-secondary-foreground">
            {story.title}
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <span className="cyber-light:text-cyan-600 cyber-dark:text-yellow-400">
                {story.phase_name || `Phase ${story.phase}`} •{' '}
                {story.epic_name || `Epic ${story.epic}`}
              </span>
              {story.target_version && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {story.target_version}
                </Badge>
              )}
            </div>
            {story.depends_on && story.depends_on.length > 0 && (
              <div>Deps: {story.depends_on.join(', ')}</div>
            )}
            {story.tags && story.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <Tag className="h-3 w-3 text-muted-foreground/50" />
                {story.tags.slice(0, 3).map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-[10px] px-1 py-0 bg-muted/50"
                  >
                    {tag}
                  </Badge>
                ))}
                {story.tags.length > 3 && (
                  <span className="text-[10px] text-muted-foreground/50">
                    +{story.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
          {story.acceptance && story.acceptance.length > 0 && (
            <ul className="mt-2 text-xs text-muted-foreground space-y-0.5">
              {story.acceptance.slice(0, 3).map((ac, i) => (
                <li key={i} className="truncate">
                  <span className="cyber-light:text-pink-400">•</span> {ac}
                </li>
              ))}
              {story.acceptance.length > 3 && (
                <li className="text-muted-foreground/50 cyber-light:text-cyan-400/70 cyber-dark:text-accent">
                  +{story.acceptance.length - 3} more
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
