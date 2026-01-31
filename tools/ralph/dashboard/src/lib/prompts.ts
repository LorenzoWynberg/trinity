import fs from 'fs'
import path from 'path'

const PROMPTS_DIR = path.join(process.cwd(), 'prompts')
const AGENTS_DIR = path.join(process.cwd(), 'agents')

type PromptName = 'execution' | 'generate' | 'refine' | 'refine-edit' | 'story-edit'
type AgentName = 'analyst' | 'implementer' | 'reviewer' | 'documenter'

const promptCache = new Map<string, string>()
const agentCache = new Map<string, string>()

/**
 * Load a prompt template from the prompts directory
 */
export function loadPrompt(name: PromptName): string {
  if (promptCache.has(name)) {
    return promptCache.get(name)!
  }

  const filePath = path.join(PROMPTS_DIR, `${name}.md`)
  const content = fs.readFileSync(filePath, 'utf-8')
  promptCache.set(name, content)
  return content
}

/**
 * Fill a prompt template with values
 */
export function fillPrompt(template: string, values: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return result
}

/**
 * Load and fill a prompt in one call
 */
export function getPrompt(name: PromptName, values: Record<string, string>): string {
  const template = loadPrompt(name)
  return fillPrompt(template, values)
}

/**
 * Load an agent identity prompt from the agents directory
 */
export function loadAgentPrompt(name: AgentName): string {
  if (agentCache.has(name)) {
    return agentCache.get(name)!
  }

  const filePath = path.join(AGENTS_DIR, `${name}.md`)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Agent prompt not found: ${name}`)
  }
  const content = fs.readFileSync(filePath, 'utf-8')
  agentCache.set(name, content)
  return content
}

/**
 * Load and fill an agent prompt in one call
 */
export function getAgentPrompt(name: AgentName, values: Record<string, string>): string {
  const template = loadAgentPrompt(name)
  return fillPrompt(template, values)
}

/**
 * List available agent prompts
 */
export function listAgents(): AgentName[] {
  return ['analyst', 'implementer', 'reviewer', 'documenter']
}

/**
 * Check if an agent prompt exists
 */
export function hasAgentPrompt(name: string): name is AgentName {
  const validAgents: AgentName[] = ['analyst', 'implementer', 'reviewer', 'documenter']
  return validAgents.includes(name as AgentName)
}
