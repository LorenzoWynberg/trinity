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
  const outputFile = path.join(tmpDir, `claude-response-${requestId}.json`)

  try {
    // Write prompt to temp file with output instruction
    const fullPrompt = `${prompt}

CRITICAL: You MUST write your JSON response to this exact file path: ${outputFile}
Use the Write tool to create the file. Output ONLY valid JSON, no markdown, no explanation, no code blocks.`

    await fs.writeFile(promptFile, fullPrompt)

    // Run Claude with prompt file as stdin
    // shell: true needed for < redirection to work
    await execAsync(
      `claude --dangerously-skip-permissions --print < "${promptFile}"`,
      { cwd, timeout: timeoutMs, shell: '/bin/bash' }
    )

    // Read the output file
    try {
      const outputContent = await fs.readFile(outputFile, 'utf-8')
      const result = JSON.parse(outputContent)
      return { success: true, result }
    } catch (readError: any) {
      // Output file doesn't exist or isn't valid JSON
      return {
        success: false,
        error: `Claude did not write valid JSON to output file`,
        raw: `Expected output at: ${outputFile}`
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  } finally {
    // Cleanup temp files (ignore errors)
    await fs.unlink(promptFile).catch(() => {})
    await fs.unlink(outputFile).catch(() => {})
  }
}
