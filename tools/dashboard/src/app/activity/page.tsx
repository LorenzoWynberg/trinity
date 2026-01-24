import { getActivityLogs } from '@/lib/data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const revalidate = 5

export default async function ActivityPage() {
  const logs = await getActivityLogs()

  if (logs.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Activity</h1>
        <p className="text-muted-foreground">
          No activity logs found in docs/activity/
        </p>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="text-muted-foreground">{logs.length} log files</p>
      </div>

      <Tabs defaultValue={logs[0]?.date}>
        <TabsList className="flex-wrap h-auto gap-1">
          {logs.map(log => (
            <TabsTrigger key={log.date} value={log.date} className="text-xs">
              {log.date}
            </TabsTrigger>
          ))}
        </TabsList>

        {logs.map(log => (
          <TabsContent key={log.date} value={log.date}>
            <Card>
              <CardHeader>
                <CardTitle>{log.date}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg overflow-auto">
                    {log.content}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
