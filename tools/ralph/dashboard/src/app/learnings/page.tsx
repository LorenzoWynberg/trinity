import { getLearnings } from '@/lib/data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Markdown } from '@/components/markdown'
import { BookOpen, AlertTriangle, Lightbulb, FileCode } from 'lucide-react'

export const revalidate = 5

const categoryConfig: Record<string, { icon: typeof BookOpen; label: string }> = {
  gotchas: { icon: AlertTriangle, label: 'Gotchas' },
  patterns: { icon: Lightbulb, label: 'Patterns' },
  conventions: { icon: FileCode, label: 'Conventions' },
}

export default async function LearningsPage() {
  const learnings = await getLearnings()

  if (learnings.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Learnings</h1>
        <p className="text-muted-foreground">
          No learnings found in docs/learnings/
        </p>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Learnings</h1>
        <p className="text-muted-foreground">Knowledge extracted from completed stories</p>
      </div>

      <Tabs defaultValue={learnings[0]?.category}>
        <TabsList>
          {learnings.map(learning => {
            const config = categoryConfig[learning.category] || { icon: BookOpen, label: learning.category }
            const Icon = config.icon
            return (
              <TabsTrigger key={learning.category} value={learning.category} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {config.label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {learnings.map(learning => (
          <TabsContent key={learning.category} value={learning.category}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {(() => {
                    const config = categoryConfig[learning.category] || { icon: BookOpen, label: learning.category }
                    const Icon = config.icon
                    return (
                      <>
                        <Icon className="h-5 w-5" />
                        {config.label}
                      </>
                    )
                  })()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Markdown content={learning.content} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
