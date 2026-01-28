import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

const PROJECT_ROOT = path.join(process.cwd(), '../../..')
export const RALPH_CLI_DIR = path.join(PROJECT_ROOT, 'tools/ralph/cli')
export const PRD_DIR = path.join(RALPH_CLI_DIR, 'prd')

export type ClaudeResult = {
  success: boolean
  result?: any
  error?: string
  raw?: string
}

/**
 * Run Claude and parse JSON from stdout
 * Uses echo | claude pattern that was working before
 */
export async function runClaude(
  prompt: string,
  options: {
    cwd?: string
    timeoutMs?: number
  } = {}
): Promise<ClaudeResult> {
  const { cwd = RALPH_CLI_DIR, timeoutMs = 120000 } = options

  try {
    // Run Claude with echo pipe (original working pattern)
    const { stdout } = await execAsync(
      `echo ${JSON.stringify(prompt)} | claude --dangerously-skip-permissions --print`,
      { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }
    )

    // Parse JSON from output
    try {
      // Try to extract JSON from response
      const jsonMatch = stdout.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        return { success: true, result }
      } else {
        return {
          success: false,
          error: 'No JSON found in response',
          raw: stdout.slice(0, 1000)
        }
      }
    } catch (parseError: any) {
      return {
        success: false,
        error: `Failed to parse JSON: ${parseError.message}`,
        raw: stdout.slice(0, 1000)
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      raw: error.stderr || error.stdout
    }
  }
}
