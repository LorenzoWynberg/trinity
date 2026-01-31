import { NextRequest, NextResponse } from 'next/server'
import { getPRD } from '@/lib/data'
import * as execution from '@/lib/execution'
import * as state from '@/lib/run-state'
import * as handoffs from '@/lib/db/handoffs'

const VALID_ACTIONS = ['start', 'continue', 'stop', 'reset'] as const

// GET /api/run - Get execution status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const version = searchParams.get('version') || 'v0.1'

    const prd = await getPRD(version)
    if (!prd) {
      return NextResponse.json({ error: 'PRD not found' }, { status: 404 })
    }

    const status = await execution.getExecutionStatus(prd)

    return NextResponse.json(status)
  } catch (error: any) {
    console.error('[run] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/run - Start or continue execution
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      version = 'v0.1',
      action = 'start',
      config,
      gateResponse
    } = body

    // Validate action
    if (!VALID_ACTIONS.includes(action as any)) {
      return NextResponse.json({
        error: `Invalid action: ${action}. Valid actions: ${VALID_ACTIONS.join(', ')}`
      }, { status: 400 })
    }

    const prd = await getPRD(version)
    if (!prd) {
      return NextResponse.json({ error: 'PRD not found' }, { status: 404 })
    }

    if (action === 'start' || action === 'continue') {
      // On start, check for stale handoffs and timeout them
      if (action === 'start') {
        const staleHandoffs = handoffs.findStale(30) // 30 minute threshold
        for (const stale of staleHandoffs) {
          handoffs.timeout(stale.id, `Timed out on restart (was pending for ${stale.to_agent})`)
        }
      }

      const execConfig: execution.ExecutionConfig = {
        version,
        baseBranch: config?.baseBranch || 'dev',
        maxIterations: config?.maxIterations || 100,
        autoMode: config?.autoMode || false,
        claudeTimeout: config?.claudeTimeout || 900,
        oneShotMode: config?.oneShotMode || false,
        singleStoryId: config?.singleStoryId
      }

      const result = await execution.runIteration(prd, execConfig, gateResponse)

      return NextResponse.json(result)
    }

    if (action === 'stop') {
      await state.setStatus('idle')
      return NextResponse.json({ status: 'stopped' })
    }

    if (action === 'reset') {
      // Clear stale handoffs on reset
      const staleHandoffs = handoffs.findStale(0) // All pending handoffs
      for (const stale of staleHandoffs) {
        handoffs.timeout(stale.id, 'Reset by user')
      }
      await state.resetState()
      return NextResponse.json({ status: 'reset', clearedHandoffs: staleHandoffs.length })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('[run] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
