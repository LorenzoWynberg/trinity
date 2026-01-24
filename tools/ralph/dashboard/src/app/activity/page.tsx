import { getActivityLogs } from '@/lib/data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Markdown } from '@/components/markdown'
import { Badge } from '@/components/ui/badge'
import { Archive } from 'lucide-react'

export const revalidate = 5

export default async function ActivityPage() {
  const logs = await getActivityLogs()

  if (logs.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Activity</h1>
        <p className="text-muted-foreground">
          No activity logs found in logs/activity/
        </p>
      </div>
    )
  }

  const recentLogs = logs.filter(log => !log.archived)
  const archivedLogs = logs.filter(log => log.archived)

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="text-muted-foreground">
          {recentLogs.length} recent, {archivedLogs.length} archived
        </p>
      </div>

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
    </div>
  )
}
