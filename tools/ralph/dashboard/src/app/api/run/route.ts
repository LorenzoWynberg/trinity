import { NextRequest, NextResponse } from 'next/server'
import { getPRD } from '@/lib/data'
import * as execution from '@/lib/execution'
import * as state from '@/lib/run-state'

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

    const prd = await getPRD(version)
    if (!prd) {
      return NextResponse.json({ error: 'PRD not found' }, { status: 404 })
    }

    if (action === 'start' || action === 'continue') {
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
      await state.resetState()
      return NextResponse.json({ status: 'reset' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('[run] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
