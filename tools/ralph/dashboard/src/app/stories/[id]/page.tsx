import {
  getPRD,
  getState,
  getStoryById,
  getVersions,
  getSettings,
} from '@/lib/data';
import { getStoryStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StoryEditButton } from '@/components/story-edit-button';
import Link from 'next/link';
import {
  ArrowLeft,
  GitBranch,
  ExternalLink,
  CheckCircle2,
  Circle,
  ArrowUp,
  Tag,
} from 'lucide-react';

export const revalidate = 5;

const statusConfig = {
  pending: { label: 'Pending', className: 'bg-gray-500' },
  in_progress: { label: 'In Progress', className: 'bg-blue-500' },
  passed: { label: 'Passed', className: 'bg-yellow-500' },
  merged: { label: 'Merged', className: 'bg-green-500' },
  skipped: { label: 'Skipped', className: 'bg-purple-500' },
  blocked: { label: 'Blocked', className: 'bg-red-500' },
};

export default async function StoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [settings, versions, state] = await Promise.all([
    getSettings(),
    getVersions(),
    getState(),
  ]);

  // Resolve current version
  let currentVersion: string;
  if (
    settings.defaultVersion !== 'first' &&
    versions.includes(settings.defaultVersion)
  ) {
    currentVersion = settings.defaultVersion;
  } else {
    currentVersion = versions.length > 0 ? versions[0] : 'v0.1';
  }

  const prd = await getPRD(currentVersion);

  if (!prd) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">No PRD found.</p>
      </div>
    );
  }

  const story = getStoryById(prd, id);

  if (!story) {
    return (
      <div className="p-8">
        <Link
          href="/stories"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to stories
        </Link>
        <p className="text-muted-foreground">Story not found: {id}</p>
      </div>
    );
  }

  const currentStoryId = state?.current_story || null;
  const status = getStoryStatus(story, currentStoryId);
  const config = statusConfig[status];

  // Get dependency stories
  const dependencies =
    story.depends_on
      ?.map((depId) => getStoryById(prd, depId))
      .filter(Boolean) || [];

  // Find stories that depend on this one
  const dependents = prd.stories.filter((s) =>
    s.depends_on?.includes(story.id),
  );

  // Build branch name
  const branchName = `feat/story-${story.phase}.${story.epic}.${story.story_number}`;

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <Link
        href="/stories"
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground cyber-dark:hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to stories
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold font-mono cyber-light:text-pink-600 cyber-dark:text-foreground">
            {story.id}
          </h1>
          <Badge className={config.className}>{config.label}</Badge>
          {story.priority && story.priority > 0 && (
            <Badge variant="outline" className="gap-1 text-orange-500 border-orange-500/50">
              <ArrowUp className="h-3 w-3" />
              Priority {story.priority}
            </Badge>
          )}
          <StoryEditButton
            story={story}
            status={status}
            version={currentVersion}
          />
        </div>
        <p className="text-xl cyber-dark:text-secondary-foreground">
          {story.title}
        </p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            {story.phase_name
              ? `${String(story.phase).padStart(2, '0')}. ${story.phase_name}`
              : `Phase ${story.phase}`}
          </span>
          <span className="cyber-dark:text-accent">•</span>
          <span>
            {story.epic_name
              ? `${String(story.epic).padStart(2, '0')}. ${story.epic_name}`
              : `Epic ${story.epic}`}
          </span>
          <span className="cyber-dark:text-accent">•</span>
          <div className="flex items-center gap-1">
            <GitBranch className="h-4 w-4 cyber-dark:text-accent" />
            <code>{branchName}</code>
          </div>
        </div>
        {story.tags && story.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="h-4 w-4 text-muted-foreground" />
            {story.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {story.intent && (
        <Card className="gap-2 py-6">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm cyber-dark:text-foreground">
              Intent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground cyber-dark:text-muted-foreground">
              {story.intent}
            </p>
          </CardContent>
        </Card>
      )}

      {story.description && (
        <Card className="gap-2 py-6">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm cyber-dark:text-foreground">
              Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground cyber-dark:text-muted-foreground">
              {story.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Acceptance Criteria */}
      <Card className="gap-2 py-6">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm cyber-dark:text-foreground">
            Acceptance Criteria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 cyber-dark:text-muted-foreground">
            {story.acceptance.map((ac, i) => (
              <li key={i} className="flex items-start gap-2">
                {story.merged ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                )}
                <span>{ac}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dependencies */}
        <Card className="gap-2 py-6">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm cyber-dark:text-foreground">
              Dependencies ({dependencies.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dependencies.length === 0 ? (
              <p className="text-muted-foreground text-sm">No dependencies</p>
            ) : (
              <ul className="space-y-2">
                {dependencies.map(
                  (dep) =>
                    dep && (
                      <li key={dep.id}>
                        <Link
                          href={`/stories/${dep.id}`}
                          className="flex items-center justify-between text-sm hover:text-primary"
                        >
                          <span className="font-mono">{dep.id}</span>
                          <Badge
                            variant={dep.merged ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {dep.merged
                              ? 'Merged'
                              : dep.passes
                                ? 'Passed'
                                : 'Pending'}
                          </Badge>
                        </Link>
                      </li>
                    ),
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Dependents */}
        <Card className="gap-2 py-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm cyber-dark:text-foreground">
              Blocks ({dependents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dependents.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No stories depend on this
              </p>
            ) : (
              <ul className="space-y-2">
                {dependents.map((dep) => (
                  <li key={dep.id}>
                    <Link
                      href={`/stories/${dep.id}`}
                      className="flex items-center justify-between text-sm hover:text-primary"
                    >
                      <span className="font-mono">{dep.id}</span>
                      <Badge
                        variant={dep.merged ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {dep.merged
                          ? 'Merged'
                          : dep.passes
                            ? 'Passed'
                            : 'Pending'}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Metadata */}
      {(story.skipped || story.merge_commit || story.pr_url) && (
        <Card className="gap-2 py-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm cyber-dark:text-foreground">
              Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {story.skipped && story.skip_reason && (
              <div>
                <span className="text-muted-foreground">Skip reason:</span>{' '}
                <span>{story.skip_reason}</span>
              </div>
            )}
            {story.pr_url && (
              <div>
                <span className="text-muted-foreground">Pull request:</span>{' '}
                <a
                  href={story.pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <span>#{story.pr_url.split('/').pop()}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {story.merge_commit && (
              <div>
                <span className="text-muted-foreground">Merge commit:</span>{' '}
                <a
                  href={`https://github.com/trinity-ai-labs/trinity/commit/${story.merge_commit}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <code className="text-xs">
                    {story.merge_commit.slice(0, 8)}
                  </code>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
