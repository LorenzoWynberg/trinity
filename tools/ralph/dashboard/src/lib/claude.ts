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
 * Run Claude with temp files for reliable I/O
 *
 * Writes prompt to a temp file and instructs Claude to write JSON response
 * to another temp file. This avoids shell escaping issues and unreliable
 * stdout parsing.
 */
export async function runClaude(
  prompt: string,
  options: {
    cwd?: string
    timeoutMs?: number
  } = {}
): Promise<ClaudeResult> {
  const { cwd = RALPH_CLI_DIR, timeoutMs = 120000 } = options
  const requestId = randomUUID()
  const tmpDir = os.tmpdir()
  const promptFile = path.join(tmpDir, `claude-prompt-${requestId}.md`)

  try {
    // Write prompt to temp file (avoids shell escaping issues)
    const fullPrompt = `${prompt}

Output ONLY valid JSON (no markdown, no code blocks, no explanation).`

    await fs.writeFile(promptFile, fullPrompt)

    // Run Claude and capture stdout
    const { stdout, stderr } = await execAsync(
      `claude --dangerously-skip-permissions --print < "${promptFile}"`,
      { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }
    )

    // Parse JSON from stdout
    const trimmed = stdout.trim()

    // Try to extract JSON if wrapped in markdown code blocks
    let jsonStr = trimmed
    const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    try {
      const result = JSON.parse(jsonStr)
      return { success: true, result }
    } catch (parseError: any) {
      return {
        success: false,
        error: `Failed to parse JSON from Claude output`,
        raw: trimmed.slice(0, 500)
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      raw: error.stderr || error.stdout
    }
  } finally {
    // Cleanup temp file
    await fs.unlink(promptFile).catch(() => {})
  }
}
