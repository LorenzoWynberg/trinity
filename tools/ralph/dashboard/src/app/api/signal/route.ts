/**
 * Signal API - Claude calls this to signal story completion/blocked status
 *
 * This replaces XML signal parsing from Claude output.
 * Claude uses curl to call these endpoints from within its execution.
 */

import { NextRequest, NextResponse } from 'next/server'
import * as prd from '@/lib/db/prd'
import * as handoffs from '@/lib/db/handoffs'
import * as state from '@/lib/run-state'
import { emit } from '@/lib/events'

interface SignalBody {
  storyId: string
  action: 'complete' | 'blocked' | 'progress'
  message?: string
  prUrl?: string
}

const VALID_ACTIONS = ['complete', 'blocked', 'progress'] as const

// POST /api/signal - Claude signals story status
export async function POST(request: NextRequest) {
  try {
    const body: SignalBody = await request.json()
    const { storyId, action, message, prUrl } = body

    // Validate required fields
    if (!storyId || typeof storyId !== 'string') {
      return NextResponse.json({ error: 'storyId is required' }, { status: 400 })
    }
    if (!action || typeof action !== 'string') {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }
    if (!VALID_ACTIONS.includes(action as any)) {
      return NextResponse.json({ error: `Invalid action: ${action}. Valid actions: ${VALID_ACTIONS.join(', ')}` }, { status: 400 })
    }

    const story = prd.stories.get(storyId)
    if (!story) {
      return NextResponse.json({ error: `Story ${storyId} not found` }, { status: 404 })
    }

    switch (action) {
      case 'complete': {
        // Mark story as passed
        prd.stories.markPassed(storyId)

        // Update PR URL if provided
        if (prUrl) {
          prd.stories.setPrUrl(storyId, prUrl)
        }

        // Save checkpoint
        prd.checkpoints.save(storyId, 'claude_complete', { message, prUrl })

        // Clear failure state
        await state.clearFailure()

        // Cleanup handoffs for this story
        handoffs.clearForStory(storyId)

        // Emit SSE events
        emit('story_update', { storyId, status: 'complete' })
        emit('run_state', prd.runState.get())

        return NextResponse.json({
          success: true,
          storyId,
          status: 'complete',
          message: message || `Story ${storyId} marked as complete`
        })
      }

      case 'blocked': {
        // Record the block reason
        if (message) {
          await state.recordFailure(message)
        }

        // Update run state
        prd.runState.update({
          status: 'blocked',
          last_error: message || 'Story blocked'
        })

        // Emit SSE events
        emit('story_update', { storyId, status: 'blocked', message })
        emit('run_state', prd.runState.get())

        return NextResponse.json({
          success: true,
          storyId,
          status: 'blocked',
          message: message || `Story ${storyId} marked as blocked`
        })
      }

      case 'progress': {
        // Progress update - emit SSE event for dashboard
        emit('story_update', { storyId, status: 'progress', message })
        return NextResponse.json({
          success: true,
          storyId,
          status: 'progress',
          message: message || 'Progress update received'
        })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[signal] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET /api/signal - Get current story status (for Claude to check)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storyId = searchParams.get('storyId')

    if (!storyId) {
      // Return current run state
      const runState = prd.runState.get()
      return NextResponse.json(runState)
    }

    const story = prd.stories.get(storyId)
    if (!story) {
      return NextResponse.json({ error: `Story ${storyId} not found` }, { status: 404 })
    }

    return NextResponse.json({
      storyId,
      passes: story.passes,
      merged: story.merged,
      skipped: story.skipped,
      working_branch: story.working_branch,
      pr_url: story.pr_url
    })
  } catch (error: any) {
    console.error('[signal] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
