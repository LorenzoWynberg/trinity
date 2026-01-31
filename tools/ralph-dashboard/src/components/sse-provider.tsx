'use client'

import { useSSE } from '@/lib/query/sse'

/**
 * Provider that activates SSE connection for real-time updates.
 * This must be rendered within QueryProvider.
 */
export function SSEProvider({ children }: { children: React.ReactNode }) {
  useSSE()
  return <>{children}</>
}
