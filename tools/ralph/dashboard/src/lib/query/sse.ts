'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './hooks'

type SSEEvent = {
  type: 'run_state' | 'story_update' | 'metrics'
  data: any
}

/**
 * Subscribe to server-sent events and invalidate queries accordingly
 */
export function useSSE() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const events = new EventSource('/api/events')

    events.onmessage = (e) => {
      try {
        const event: SSEEvent = JSON.parse(e.data)

        switch (event.type) {
          case 'run_state':
            // Update run state directly for instant UI update
            queryClient.setQueryData(queryKeys.runState, event.data)
            // Also invalidate execution status
            queryClient.invalidateQueries({ queryKey: ['executionStatus'] })
            break

          case 'story_update':
            // Invalidate PRD to refetch with updated story
            queryClient.invalidateQueries({ queryKey: ['prd'] })
            queryClient.invalidateQueries({ queryKey: ['story', event.data.storyId] })
            // Also invalidate execution status for queue updates
            queryClient.invalidateQueries({ queryKey: ['executionStatus'] })
            break

          case 'metrics':
            queryClient.invalidateQueries({ queryKey: queryKeys.metrics })
            break
        }
      } catch (err) {
        console.error('SSE parse error:', err)
      }
    }

    events.onerror = () => {
      // EventSource auto-reconnects, but log for debugging
      console.log('SSE connection error, reconnecting...')
    }

    return () => {
      events.close()
    }
  }, [queryClient])
}
