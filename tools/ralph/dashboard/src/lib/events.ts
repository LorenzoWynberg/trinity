/**
 * Simple in-memory pub/sub for SSE events
 *
 * Used to push updates from API routes to connected SSE clients
 */

type EventType = 'run_state' | 'story_update' | 'metrics'
type Listener = (data: string) => void

const listeners = new Set<Listener>()

/**
 * Emit an event to all connected SSE clients
 */
export function emit(type: EventType, data: any) {
  const message = JSON.stringify({ type, data })
  listeners.forEach((listener) => {
    try {
      listener(message)
    } catch {
      // Client disconnected, will be cleaned up
    }
  })
}

/**
 * Subscribe to events (used by SSE endpoint)
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Get count of connected clients (for debugging)
 */
export function getClientCount(): number {
  return listeners.size
}
