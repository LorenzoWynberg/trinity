import { NextRequest, NextResponse } from 'next/server'
import { loadAgentPrompt, listAgents, hasAgentPrompt } from '@/lib/prompts'

// GET /api/agents - List agents or get specific agent prompt
// GET /api/agents?name=analyst - Get specific agent prompt
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const name = searchParams.get('name')

    // Get specific agent prompt
    if (name) {
      if (!hasAgentPrompt(name)) {
        return NextResponse.json({
          error: `Invalid agent: ${name}. Valid agents: ${listAgents().join(', ')}`
        }, { status: 400 })
      }
      const prompt = loadAgentPrompt(name as any)
      return NextResponse.json({ name, prompt })
    }

    // List all agents with metadata
    const agents = listAgents().map(agentName => {
      const prompt = loadAgentPrompt(agentName)
      // Extract first line as description (usually the # heading)
      const firstLine = prompt.split('\n')[0]
      const description = firstLine.replace(/^#+\s*/, '').trim()
      return {
        name: agentName,
        description,
        // Extract role from prompt (look for **Role:** pattern)
        role: prompt.match(/\*\*Role:\*\*\s*(.+)/)?.[1]?.trim() || description
      }
    })

    return NextResponse.json({ agents })
  } catch (error: any) {
    console.error('[agents] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
