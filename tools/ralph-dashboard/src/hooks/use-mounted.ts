import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}

/**
 * Hook to check if the component is mounted (client-side).
 * Uses useSyncExternalStore to avoid hydration mismatches.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,  // Client: mounted
    () => false  // Server: not mounted
  )
}
