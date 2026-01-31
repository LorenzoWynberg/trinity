import { api } from './client'

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

export type HandoffState = {
  currentAgent: AgentType | null
  phase: 'analyzing' | 'implementing' | 'reviewing' | 'documenting' | 'complete' | null
  handoffs: Handoff[]
}

export async function getState(storyId: string): Promise<HandoffState> {
  return api.get(`/api/handoffs?storyId=${storyId}`)
}

export async function getPending(storyId: string, agent: AgentType): Promise<{ handoff: Handoff | null }> {
  return api.get(`/api/handoffs?storyId=${storyId}&agent=${agent}`)
}

export async function create(data: {
  storyId: string
  fromAgent: AgentType
  toAgent: AgentType
  payload?: Record<string, any>
}): Promise<{ success: boolean; handoff: Handoff }> {
  return api.post('/api/handoffs', {
    action: 'create',
    storyId: data.storyId,
    fromAgent: data.fromAgent,
    toAgent: data.toAgent,
    payload: data.payload
  })
}

export async function accept(handoffId: number, payload?: Record<string, any>): Promise<{ success: boolean; handoff: Handoff }> {
  return api.post('/api/handoffs', {
    action: 'accept',
    handoffId,
    payload
  })
}

export async function reject(handoffId: number, reason: string): Promise<{ success: boolean; handoff: Handoff }> {
  return api.post('/api/handoffs', {
    action: 'reject',
    handoffId,
    reason
  })
}
