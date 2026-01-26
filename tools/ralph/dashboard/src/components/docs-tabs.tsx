'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Markdown } from '@/components/markdown'
import { BookOpen, AlertTriangle, Lightbulb, FileCode, Layout, Terminal, Code2, Cpu } from 'lucide-react'

type Doc = {
  category: string
  content: string
}

type DocsTabsProps = {
  docs: Doc[]
  type: 'knowledge' | 'gotchas'
}

const gotchasConfig: Record<string, { icon: typeof BookOpen; label: string }> = {
  elvish: { icon: Terminal, label: 'Elvish' },
  dashboard: { icon: Layout, label: 'Dashboard' },
  go: { icon: Code2, label: 'Go' },
  patterns: { icon: Lightbulb, label: 'Patterns' },
  conventions: { icon: FileCode, label: 'Conventions' },
}

const knowledgeConfig: Record<string, { icon: typeof BookOpen; label: string }> = {
  trinity: { icon: Cpu, label: 'Trinity' },
  ralph: { icon: Terminal, label: 'Ralph' },
  dashboard: { icon: Layout, label: 'Dashboard' },
  go: { icon: Code2, label: 'Go' },
}

export function DocsTabs({ docs, type }: DocsTabsProps) {
  const config = type === 'gotchas' ? gotchasConfig : knowledgeConfig
  const defaultIcon = type === 'gotchas' ? AlertTriangle : BookOpen

  return (
    <Tabs defaultValue={docs[0]?.category}>
      <div className="overflow-x-auto -mx-2 px-2 pb-2">
        <TabsList className="inline-flex w-max md:w-auto">
          {docs.map(doc => {
            const categoryConfig = config[doc.category] || { icon: defaultIcon, label: doc.category }
            const Icon = categoryConfig.icon
            return (
              <TabsTrigger key={doc.category} value={doc.category} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {categoryConfig.label}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </div>

      {docs.map(doc => {
        const categoryConfig = config[doc.category] || { icon: defaultIcon, label: doc.category }
        const Icon = categoryConfig.icon
        return (
          <TabsContent key={doc.category} value={doc.category}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {categoryConfig.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Markdown content={doc.content} />
              </CardContent>
            </Card>
          </TabsContent>
        )
      })}
    </Tabs>
  )
}
