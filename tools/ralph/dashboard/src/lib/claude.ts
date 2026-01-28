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
 * Run Claude - prompt includes output file path, Claude writes JSON there
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
  const outputFile = path.join(os.tmpdir(), `claude-response-${requestId}.json`)

  try {
    // Add output instruction to prompt
    const fullPrompt = `${prompt}

IMPORTANT: Write your JSON response to this file: ${outputFile}
Use the Write tool to save the JSON. No markdown, no code blocks, just valid JSON.`

    // Write prompt to temp file, then pipe to Claude
    const promptFile = path.join(os.tmpdir(), `claude-prompt-${requestId}.md`)
    await fs.writeFile(promptFile, fullPrompt)

    // Run Claude with prompt file (use full path)
    const claudePath = process.env.CLAUDE_PATH || `${process.env.HOME}/.local/bin/claude`
    const { stdout, stderr } = await execAsync(
      `cat "${promptFile}" | "${claudePath}" --dangerously-skip-permissions --print`,
      { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }
    )

    // Cleanup prompt file
    await fs.unlink(promptFile).catch(() => {})

    // Read the output file Claude wrote
    try {
      const outputContent = await fs.readFile(outputFile, 'utf-8')
      const result = JSON.parse(outputContent)
      return { success: true, result }
    } catch (readError: any) {
      return {
        success: false,
        error: 'Claude did not write valid JSON to output file',
        raw: `stdout: ${stdout?.slice(0, 500)}`
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
    await fs.unlink(outputFile).catch(() => {})
  }
}
