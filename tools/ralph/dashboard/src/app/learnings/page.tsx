import { getLearnings } from '@/lib/data'
import { LearningsTabs } from '@/components/learnings-tabs'

export const revalidate = 5

export default async function LearningsPage() {
  const learnings = await getLearnings()

  if (learnings.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 cyber-light:text-pink-600 cyber-dark:text-cyan-400">Learnings</h1>
        <p className="text-muted-foreground">
          No learnings found in docs/learnings/
        </p>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold cyber-light:text-pink-600 cyber-dark:text-cyan-400">Learnings</h1>
        <p className="text-muted-foreground cyber-light:text-cyan-600">Knowledge extracted from completed stories</p>
      </div>

      <LearningsTabs learnings={learnings} />
    </div>
  )
}
