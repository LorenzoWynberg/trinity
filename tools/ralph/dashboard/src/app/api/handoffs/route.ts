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
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const storyId = searchParams.get('storyId')
  const agent = searchParams.get('agent') as handoffs.AgentType | null

  if (!storyId) {
    return NextResponse.json({ error: 'storyId required' }, { status: 400 })
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

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    )
  }
}
