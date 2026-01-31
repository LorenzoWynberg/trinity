import fs from 'fs'
import path from 'path'

const PROMPTS_DIR = path.join(process.cwd(), 'prompts')

type PromptName = 'execution' | 'generate' | 'refine' | 'refine-edit' | 'story-edit'

const promptCache = new Map<string, string>()

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
