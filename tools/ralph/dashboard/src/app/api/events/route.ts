import { NextRequest } from 'next/server'
import * as prd from '@/lib/db/prd'
import { subscribe } from '@/lib/events'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      const initialState = prd.runState.get()
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'run_state', data: initialState })}\n\n`)
      )

      // Subscribe to updates
      const unsubscribe = subscribe((data) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        } catch {
          // Client disconnected
        }
      })

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          // Client disconnected
          clearInterval(heartbeat)
        }
      }, 30000)

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        unsubscribe()
        clearInterval(heartbeat)
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
