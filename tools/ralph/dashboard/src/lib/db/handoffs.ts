import { getDb } from './index'

export type AgentType = 'orchestrator' | 'analyst' | 'implementer' | 'reviewer' | 'documenter'
export type HandoffStatus = 'pending' | 'accepted' | 'rejected'

export type Handoff = {
  id: number
  story_id: string
  from_agent: AgentType
  to_agent: AgentType
  status: HandoffStatus
  payload: Record<string, any> | null
  rejection_reason: string | null
  created_at: string
  processed_at: string | null
}

type HandoffRow = {
  id: number
  story_id: string
  from_agent: string
  to_agent: string
  status: string
  payload: string | null
  rejection_reason: string | null
  created_at: string
  processed_at: string | null
}

function parseRow(row: HandoffRow): Handoff {
  return {
    ...row,
    from_agent: row.from_agent as AgentType,
    to_agent: row.to_agent as AgentType,
    status: row.status as HandoffStatus,
    payload: row.payload ? JSON.parse(row.payload) : null
  }
}

// Create a new handoff
export function create(data: {
  story_id: string
  from_agent: AgentType
  to_agent: AgentType
  payload?: Record<string, any>
}): Handoff {
  const db = getDb()

  const result = db.prepare(`
    INSERT INTO agent_handoffs (story_id, from_agent, to_agent, payload)
    VALUES (?, ?, ?, ?)
  `).run(
    data.story_id,
    data.from_agent,
    data.to_agent,
    data.payload ? JSON.stringify(data.payload) : null
  )

  const row = db.prepare('SELECT * FROM agent_handoffs WHERE id = ?')
    .get(result.lastInsertRowid) as HandoffRow
  return parseRow(row)
}

// Get pending handoff for an agent
export function getPending(storyId: string, toAgent: AgentType): Handoff | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT * FROM agent_handoffs
    WHERE story_id = ? AND to_agent = ? AND status = 'pending'
    ORDER BY created_at DESC LIMIT 1
  `).get(storyId, toAgent) as HandoffRow | undefined

  return row ? parseRow(row) : null
}

// Get latest handoff for a story
export function getLatest(storyId: string): Handoff | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT * FROM agent_handoffs
    WHERE story_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(storyId) as HandoffRow | undefined

  return row ? parseRow(row) : null
}

// Get all handoffs for a story (for dashboard timeline)
export function listByStory(storyId: string): Handoff[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT * FROM agent_handoffs
    WHERE story_id = ?
    ORDER BY created_at ASC
  `).all(storyId) as HandoffRow[]

  return rows.map(parseRow)
}

// Accept a handoff (agent picked it up)
export function accept(id: number, additionalPayload?: Record<string, any>): Handoff {
  const db = getDb()

  if (additionalPayload) {
    const current = db.prepare('SELECT payload FROM agent_handoffs WHERE id = ?').get(id) as { payload: string | null }
    const currentPayload = current?.payload ? JSON.parse(current.payload) : {}
    const merged = { ...currentPayload, ...additionalPayload }

    db.prepare(`
      UPDATE agent_handoffs
      SET status = 'accepted', processed_at = datetime('now'), payload = ?
      WHERE id = ?
    `).run(JSON.stringify(merged), id)
  } else {
    db.prepare(`
      UPDATE agent_handoffs
      SET status = 'accepted', processed_at = datetime('now')
      WHERE id = ?
    `).run(id)
  }

  const row = db.prepare('SELECT * FROM agent_handoffs WHERE id = ?').get(id) as HandoffRow
  return parseRow(row)
}

// Reject a handoff (send back to previous agent)
export function reject(id: number, reason: string): Handoff {
  const db = getDb()

  db.prepare(`
    UPDATE agent_handoffs
    SET status = 'rejected', processed_at = datetime('now'), rejection_reason = ?
    WHERE id = ?
  `).run(reason, id)

  const row = db.prepare('SELECT * FROM agent_handoffs WHERE id = ?').get(id) as HandoffRow
  return parseRow(row)
}

// Get current agent state for a story
export function getCurrentState(storyId: string): {
  currentAgent: AgentType | null
  phase: 'analyzing' | 'implementing' | 'reviewing' | 'documenting' | 'complete' | null
  handoffs: Handoff[]
} {
  const handoffs = listByStory(storyId)

  if (handoffs.length === 0) {
    return { currentAgent: null, phase: null, handoffs: [] }
  }

  const latest = handoffs[handoffs.length - 1]

  // If latest is pending, that agent is up
  if (latest.status === 'pending') {
    const phase = latest.to_agent === 'analyst' ? 'analyzing'
      : latest.to_agent === 'implementer' ? 'implementing'
      : latest.to_agent === 'reviewer' ? 'reviewing'
      : latest.to_agent === 'documenter' ? 'documenting'
      : null
    return { currentAgent: latest.to_agent, phase, handoffs }
  }

  // If latest was accepted and to orchestrator, we're done
  if (latest.to_agent === 'orchestrator' && latest.status === 'accepted') {
    return { currentAgent: null, phase: 'complete', handoffs }
  }

  return { currentAgent: null, phase: null, handoffs }
}
