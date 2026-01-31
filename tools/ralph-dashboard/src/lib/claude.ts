import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { randomUUID } from 'crypto'

const execAsync = promisify(exec)

// Dashboard runs from tools/ralph-dashboard, so project root is 2 levels up
const PROJECT_ROOT = path.resolve(process.cwd(), '../..')

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
  const { cwd = PROJECT_ROOT, timeoutMs = 900000 } = options // 15 min default
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

    console.log('[runClaude] Request ID:', requestId)
    console.log('[runClaude] Prompt file:', promptFile)
    console.log('[runClaude] Output file:', outputFile)
    console.log('[runClaude] CWD:', cwd)
    console.log('[runClaude] Prompt length:', fullPrompt.length)

    // Run Claude with prompt file as stdin
    const { stdout, stderr } = await execAsync(
      `claude --dangerously-skip-permissions --print < "${promptFile}"`,
      { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }
    )

    console.log('[runClaude] Claude finished, stdout length:', stdout?.length, 'stderr length:', stderr?.length)

    // Cleanup prompt file
    await fs.unlink(promptFile).catch(() => {})

    // Read the output file Claude wrote
    try {
      const outputContent = await fs.readFile(outputFile, 'utf-8')
      const result = JSON.parse(outputContent)
      return { success: true, result }
    } catch {
      return {
        success: false,
        error: 'Claude did not write valid JSON to output file',
        raw: `stdout: ${stdout?.slice(0, 500)}\nstderr: ${stderr?.slice(0, 500)}`
      }
    }
  } catch (error: any) {
    console.error('[runClaude] Command failed:', error.message)
    console.error('[runClaude] Exit code:', error.code)
    console.error('[runClaude] Signal:', error.signal)
    console.error('[runClaude] Killed:', error.killed)
    console.error('[runClaude] Stdout:', error.stdout?.slice(0, 500))
    console.error('[runClaude] Stderr:', error.stderr?.slice(0, 500))
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
