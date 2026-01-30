/**
 * Signal API - Claude calls this to signal story completion/blocked status
 *
 * This replaces XML signal parsing from Claude output.
 * Claude uses curl to call these endpoints from within its execution.
 */

import { NextRequest, NextResponse } from 'next/server'
import * as prd from '@/lib/db/prd'
import * as state from '@/lib/run-state'

interface SignalBody {
  storyId: string
  action: 'complete' | 'blocked' | 'progress'
  message?: string
  prUrl?: string
}

// POST /api/signal - Claude signals story status
export async function POST(request: NextRequest) {
  try {
    const body: SignalBody = await request.json()
    const { storyId, action, message, prUrl } = body

    if (!storyId || !action) {
      return NextResponse.json({ error: 'storyId and action are required' }, { status: 400 })
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

        return NextResponse.json({
          success: true,
          storyId,
          status: 'blocked',
          message: message || `Story ${storyId} marked as blocked`
        })
      }

      case 'progress': {
        // Just a progress update - no state change
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
