import { NextRequest, NextResponse } from 'next/server'
import * as handoffs from '@/lib/db/handoffs'

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
        const handoff = handoffs.create({
          story_id: body.storyId,
          from_agent: body.fromAgent,
          to_agent: body.toAgent,
          payload: body.payload
        })
        return NextResponse.json({ success: true, handoff })
      }

      case 'accept': {
        const handoff = handoffs.accept(body.handoffId, body.payload)
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
