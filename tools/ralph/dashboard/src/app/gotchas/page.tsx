import { getGotchasChapters } from '@/lib/data'
import { ChapterNav } from '@/components/chapter-nav'
import { Suspense } from 'react'

export const revalidate = 5

function ChapterNavFallback() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-9 bg-muted rounded-lg w-64" />
      <div className="h-96 bg-muted rounded-lg" />
    </div>
  )
}

export default async function GotchasPage() {
  const chapters = await getGotchasChapters()

  if (chapters.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 cyber-light:text-pink-600 cyber-dark:text-cyan-400">Gotchas</h1>
        <p className="text-muted-foreground">
          No gotchas found in docs/gotchas/
        </p>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold cyber-light:text-pink-600 cyber-dark:text-cyan-400">Gotchas</h1>
        <p className="text-muted-foreground cyber-light:text-cyan-600">Common pitfalls and mistakes to avoid</p>
      </div>

      <Suspense fallback={<ChapterNavFallback />}>
        <ChapterNav chapters={chapters} basePath="/gotchas" />
      </Suspense>
    </div>
  )
}
