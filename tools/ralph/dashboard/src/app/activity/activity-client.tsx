'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Markdown } from '@/components/markdown'
import { Badge } from '@/components/ui/badge'
import { Archive, Folder } from 'lucide-react'
import type { ActivityProject } from '@/lib/data'

interface Log {
  date: string
  content: string
  archived: boolean
}

interface ActivityClientProps {
  initialLogs: Log[]
  initialProject: ActivityProject
  projects: ActivityProject[]
}

export function ActivityClient({ initialLogs, initialProject, projects }: ActivityClientProps) {
  const [currentProject, setCurrentProject] = useState<ActivityProject>(initialProject)
  const [logs, setLogs] = useState<Log[]>(initialLogs)
  const [loading, setLoading] = useState(false)

  const handleProjectChange = async (project: ActivityProject) => {
    if (project === currentProject) return
    setLoading(true)
    try {
      const res = await fetch(`/api/activity?project=${project}`)
      const data = await res.json()
      setLogs(data.logs || [])
      setCurrentProject(project)
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const recentLogs = logs.filter(log => !log.archived)
  const archivedLogs = logs.filter(log => log.archived)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold cyber-light:text-pink-600 cyber-dark:text-cyan-400">Activity</h1>
          <p className="text-muted-foreground cyber-light:text-cyan-600">
            {recentLogs.length} recent, {archivedLogs.length} archived
          </p>
        </div>

        {/* Project selector */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {projects.map(project => (
            <button
              key={project}
              onClick={() => handleProjectChange(project)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${currentProject === project
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}
              disabled={loading}
            >
              <Folder className="h-3.5 w-3.5" />
              {project.charAt(0).toUpperCase() + project.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : logs.length === 0 ? (
        <p className="text-muted-foreground">
          No activity logs found for {currentProject}
        </p>
      ) : (
        <Tabs defaultValue="recent">
          <TabsList>
            <TabsTrigger value="recent">
              Recent ({recentLogs.length})
            </TabsTrigger>
            <TabsTrigger value="archived" className="flex items-center gap-1">
              <Archive className="h-3 w-3" />
              Archived ({archivedLogs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="mt-4">
            {recentLogs.length === 0 ? (
              <p className="text-muted-foreground">No recent logs</p>
            ) : (
              <Tabs defaultValue={recentLogs[0]?.date}>
                <TabsList className="flex-wrap h-auto gap-1">
                  {recentLogs.map(log => (
                    <TabsTrigger key={log.date} value={log.date} className="text-xs">
                      {log.date}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {recentLogs.map(log => (
                  <TabsContent key={log.date} value={log.date}>
                    <Card>
                      <CardHeader>
                        <CardTitle>{log.date}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Markdown content={log.content} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </TabsContent>

          <TabsContent value="archived" className="mt-4">
            {archivedLogs.length === 0 ? (
              <p className="text-muted-foreground">No archived logs</p>
            ) : (
              <Tabs defaultValue={archivedLogs[0]?.date}>
                <TabsList className="flex-wrap h-auto gap-1">
                  {archivedLogs.map(log => (
                    <TabsTrigger key={log.date} value={log.date} className="text-xs">
                      {log.date}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {archivedLogs.map(log => (
                  <TabsContent key={log.date} value={log.date}>
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          {log.date}
                          <Badge variant="secondary" className="text-xs">
                            <Archive className="h-3 w-3 mr-1" />
                            Archived
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Markdown content={log.content} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
