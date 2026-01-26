'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Markdown } from '@/components/markdown'
import { BookOpen, AlertTriangle, Lightbulb, FileCode } from 'lucide-react'

type Learning = {
  category: string
  content: string
}

type LearningsTabsProps = {
  learnings: Learning[]
}

const categoryConfig: Record<string, { icon: typeof BookOpen; label: string }> = {
  gotchas: { icon: AlertTriangle, label: 'Gotchas' },
  patterns: { icon: Lightbulb, label: 'Patterns' },
  conventions: { icon: FileCode, label: 'Conventions' },
}

export function LearningsTabs({ learnings }: LearningsTabsProps) {
  return (
    <Tabs defaultValue={learnings[0]?.category}>
      <div className="overflow-x-auto -mx-2 px-2 pb-2">
        <TabsList className="inline-flex w-max md:w-auto">
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
      </div>

      {learnings.map(learning => {
        const config = categoryConfig[learning.category] || { icon: BookOpen, label: learning.category }
        const Icon = config.icon
        return (
          <TabsContent key={learning.category} value={learning.category}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {config.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Markdown content={learning.content} />
              </CardContent>
            </Card>
          </TabsContent>
        )
      })}
    </Tabs>
  )
}
