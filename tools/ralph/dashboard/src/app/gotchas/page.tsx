import { getGotchas } from '@/lib/data'
import { DocsTabs } from '@/components/docs-tabs'

export const revalidate = 5

export default async function GotchasPage() {
  const gotchas = await getGotchas()

  if (gotchas.length === 0) {
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

      <DocsTabs docs={gotchas} type="gotchas" />
    </div>
  )
}
