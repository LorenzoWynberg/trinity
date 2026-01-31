import { NextRequest, NextResponse } from 'next/server'
import * as handoffs from '@/lib/db/handoffs'
import { emit } from '@/lib/events'

const VALID_AGENTS = ['orchestrator', 'analyst', 'implementer', 'reviewer', 'documenter'] as const
const VALID_TRANSITIONS: Record<string, string[]> = {
  orchestrator: ['analyst'],
  analyst: ['implementer'],
  implementer: ['reviewer'],
  reviewer: ['documenter', 'implementer'], // can reject back to implementer
  documenter: ['orchestrator'],
}

function isValidAgent(agent: string): agent is handoffs.AgentType {
  return VALID_AGENTS.includes(agent as any)
}

function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

// GET /api/handoffs?storyId=xxx - Get handoffs for a story
// GET /api/handoffs?storyId=xxx&agent=implementer - Get pending handoff for agent
// GET /api/handoffs?stale=true&minutes=30 - Get stale pending handoffs
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const storyId = searchParams.get('storyId')
  const agent = searchParams.get('agent') as handoffs.AgentType | null
  const stale = searchParams.get('stale')
  const minutes = parseInt(searchParams.get('minutes') || '30', 10)

  // Get stale handoffs (monitoring endpoint)
  if (stale === 'true') {
    const staleHandoffs = handoffs.findStale(minutes)
    return NextResponse.json({ stale: staleHandoffs, thresholdMinutes: minutes })
  }

  if (!storyId) {
    return NextResponse.json({ error: 'storyId required' }, { status: 400 })
  }

  // Validate agent if provided
  if (agent && !isValidAgent(agent)) {
    return NextResponse.json({ error: `Invalid agent: ${agent}` }, { status: 400 })
  }

  // Get pending handoff for specific agent
  if (agent) {
    const pending = handoffs.getPending(storyId, agent)
    return NextResponse.json({ handoff: pending })
  }

  // Get all handoffs + current state
  const state = handoffs.getCurrentState(storyId)
  return NextResponse.json(state)
}

// POST /api/handoffs - Create or update a handoff
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'create': {
        // Validate required storyId
        if (!body.storyId || typeof body.storyId !== 'string') {
          return NextResponse.json({ error: 'storyId is required' }, { status: 400 })
        }
        // Validate agents
        if (!isValidAgent(body.fromAgent)) {
          return NextResponse.json({ error: `Invalid fromAgent: ${body.fromAgent}` }, { status: 400 })
        }
        if (!isValidAgent(body.toAgent)) {
          return NextResponse.json({ error: `Invalid toAgent: ${body.toAgent}` }, { status: 400 })
        }
        // Validate transition (skip for rejections which go backwards)
        if (!isValidTransition(body.fromAgent, body.toAgent)) {
          return NextResponse.json({
            error: `Invalid transition: ${body.fromAgent} → ${body.toAgent}`
          }, { status: 400 })
        }
        // Check for existing pending handoff to same agent
        const existing = handoffs.getPending(body.storyId, body.toAgent)
        if (existing) {
          return NextResponse.json({
            error: `Pending handoff already exists for ${body.toAgent}`,
            existing
          }, { status: 409 })
        }

        const handoff = handoffs.create({
          story_id: body.storyId,
          from_agent: body.fromAgent,
          to_agent: body.toAgent,
          payload: body.payload
        })
        // Emit SSE event
        emit('handoff', {
          action: 'create',
          storyId: body.storyId,
          handoff,
          state: handoffs.getCurrentState(body.storyId)
        })
        return NextResponse.json({ success: true, handoff })
      }

      case 'accept': {
        // Validate handoffId
        if (typeof body.handoffId !== 'number' || body.handoffId <= 0) {
          return NextResponse.json({ error: 'Valid handoffId is required' }, { status: 400 })
        }
        const handoff = handoffs.accept(body.handoffId, body.payload)
        // Emit SSE event
        emit('handoff', {
          action: 'accept',
          storyId: handoff.story_id,
          handoff,
          state: handoffs.getCurrentState(handoff.story_id)
        })
        return NextResponse.json({ success: true, handoff })
      }

      case 'reject': {
        // Validate handoffId
        if (typeof body.handoffId !== 'number' || body.handoffId <= 0) {
          return NextResponse.json({ error: 'Valid handoffId is required' }, { status: 400 })
        }
        // Validate reason
        if (!body.reason || typeof body.reason !== 'string' || body.reason.trim() === '') {
          return NextResponse.json({ error: 'reason is required for rejection' }, { status: 400 })
        }
        const handoff = handoffs.reject(body.handoffId, body.reason)
        // Create new handoff back to previous agent
        const returnHandoff = handoffs.create({
          story_id: handoff.story_id,
          from_agent: handoff.to_agent,
          to_agent: handoff.from_agent,
          payload: {
            ...handoff.payload,
            rejection_reason: body.reason,
            rejected_by: handoff.to_agent
          }
        })
        // Emit SSE event
        emit('handoff', {
          action: 'reject',
          storyId: handoff.story_id,
          handoff: returnHandoff,
          state: handoffs.getCurrentState(handoff.story_id)
        })
        return NextResponse.json({ success: true, handoff: returnHandoff })
      }

      case 'timeout': {
        // Timeout a stale handoff
        if (typeof body.handoffId !== 'number' || body.handoffId <= 0) {
          return NextResponse.json({ error: 'Valid handoffId is required' }, { status: 400 })
        }
        const handoff = handoffs.timeout(body.handoffId, body.reason || 'Agent timed out')
        // Emit SSE event
        emit('handoff', {
          action: 'timeout',
          storyId: handoff.story_id,
          handoff,
          state: handoffs.getCurrentState(handoff.story_id)
        })
        return NextResponse.json({ success: true, handoff })
      }

      case 'cleanup': {
        // Clear all handoffs for a story
        if (!body.storyId || typeof body.storyId !== 'string') {
          return NextResponse.json({ error: 'storyId is required' }, { status: 400 })
        }
        const deleted = handoffs.clearForStory(body.storyId)
        // Emit SSE event
        emit('handoff', {
          action: 'cleanup',
          storyId: body.storyId,
          deleted
        })
        return NextResponse.json({ success: true, deleted })
      }

      default:
        return NextResponse.json({ error: `Invalid action: ${action}. Valid actions: create, accept, reject, timeout, cleanup` }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    )
  }
}
