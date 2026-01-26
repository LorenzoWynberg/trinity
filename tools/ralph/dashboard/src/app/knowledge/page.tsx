import { getKnowledge } from '@/lib/data'
import { DocsTabs } from '@/components/docs-tabs'

export const revalidate = 5

export default async function KnowledgePage() {
  const knowledge = await getKnowledge()

  if (knowledge.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 cyber-light:text-pink-600 cyber-dark:text-cyan-400">Knowledge Base</h1>
        <p className="text-muted-foreground">
          No knowledge docs found in docs/knowledge/
        </p>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold cyber-light:text-pink-600 cyber-dark:text-cyan-400">Knowledge Base</h1>
        <p className="text-muted-foreground cyber-light:text-cyan-600">Product documentation for Trinity and Ralph</p>
      </div>

      <DocsTabs docs={knowledge} type="knowledge" />
    </div>
  )
}
