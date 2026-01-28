import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { randomUUID } from 'crypto'

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
 * Run Claude with temp file for input, parse JSON from stdout
 */
export async function runClaude(
  prompt: string,
  options: {
    cwd?: string
    timeoutMs?: number
  } = {}
): Promise<ClaudeResult> {
  const { cwd = RALPH_CLI_DIR, timeoutMs = 120000 } = options
  const promptFile = path.join(os.tmpdir(), `claude-prompt-${randomUUID()}.md`)

  try {
    // Write prompt to temp file (avoids shell escaping/size limits)
    await fs.writeFile(promptFile, prompt)

    // Run Claude with temp file as stdin, capture stdout
    const { stdout, stderr } = await execAsync(
      `claude --dangerously-skip-permissions --print < "${promptFile}"`,
      { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, shell: '/bin/bash' }
    )

    // Parse JSON from stdout
    try {
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
      raw: error.stderr || error.stdout || 'no output'
    }
  } finally {
    // Cleanup
    await fs.unlink(promptFile).catch(() => {})
  }
}
