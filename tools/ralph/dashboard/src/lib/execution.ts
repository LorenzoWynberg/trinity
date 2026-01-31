/**
 * Execution Loop - Ported from CLI ralph.elv
 *
 * Handles the full story execution flow:
 * 1. Story selection (smart scoring)
 * 2. Validation gate
 * 3. External deps gate
 * 4. Branch creation
 * 5. Claude execution
 * 6. Signal detection
 * 7. PR flow
 * 8. State updates
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { randomUUID } from 'crypto'
import type { Story, PRD } from './types'
import { getNextStory, getRunnableStories, getScoredStories, type StoryScore } from './scoring'
import * as state from './run-state'
import * as git from './git'
import * as prdDb from './db/prd'
import { settings } from './db'

const execAsync = promisify(exec)

const PROJECT_ROOT = path.resolve(process.cwd(), '../../..')
const PROMPT_FILE = path.join(process.cwd(), 'prompts/execution.md')

export type ExecutionStatus =
  | 'idle'
  | 'selecting_story'
  | 'validation_gate'
  | 'external_deps_gate'
  | 'creating_branch'
  | 'running_claude'
  | 'pr_gate'
  | 'complete'
  | 'blocked'
  | 'error'

export type GateType = 'validation' | 'external_deps' | 'pr_review' | 'between_stories'

export interface GateRequest {
  type: GateType
  storyId: string
  data: any
}

export interface ExecutionConfig {
  version: string
  baseBranch: string
  maxIterations: number
  autoMode: boolean         // Auto-clarify, auto-PR, auto-merge
  claudeTimeout: number     // seconds
  oneShotMode: boolean      // Exit after one story
  singleStoryId?: string    // Work on specific story
}

export interface ExecutionEvent {
  type: 'status' | 'log' | 'gate' | 'progress' | 'complete' | 'error'
  timestamp: string
  data: any
}

export interface ValidationResult {
  valid: boolean
  questions?: string[]
}

// Claude signals via API now - no need to parse output
// See /api/signal endpoint

/**
 * Load prompt template
 */
async function loadPromptTemplate(): Promise<string> {
  return fs.readFile(PROMPT_FILE, 'utf-8')
}

/**
 * Build the prompt for Claude
 * Minimal prompt - Claude fetches story details via API
 */
async function buildPrompt(
  story: Story,
  branch: string,
  attempt: number,
  version: string,
  options: {
    clarification?: string
    feedback?: string
    externalDepsReport?: string
    previousFailure?: string
  } = {}
): Promise<string> {
  const template = await loadPromptTemplate()

  // Get settings
  const dashboardUrl = settings.get('dashboardUrl') || 'http://localhost:3000'
  const timezone = settings.get('timezone') || 'UTC'

  // Build feedback section from all context
  let feedbackSection = ''
  if (options.clarification) {
    feedbackSection += `## Clarification\n${options.clarification}\n\n`
  }
  if (options.feedback) {
    feedbackSection += `## Feedback\n${options.feedback}\n\n`
  }
  if (options.externalDepsReport) {
    feedbackSection += `## External Deps\n${options.externalDepsReport}\n\n`
  }
  if (options.previousFailure) {
    feedbackSection += `## Previous Failure\n${options.previousFailure}\n\n`
  }

  // Replace placeholders
  const prompt = template
    .replace(/\{\{STORY_ID\}\}/g, story.id)
    .replace(/\{\{VERSION\}\}/g, version)
    .replace(/\{\{BRANCH\}\}/g, branch)
    .replace(/\{\{ATTEMPT\}\}/g, String(attempt))
    .replace(/\{\{DASHBOARD_URL\}\}/g, dashboardUrl)
    .replace(/\{\{TIMEZONE\}\}/g, timezone)
    .replace(/\{\{FEEDBACK\}\}/g, feedbackSection)

  return prompt
}

interface ClaudeResult {
  success: boolean
  duration: number
  inputTokens: number
  outputTokens: number
  error?: string
}

/**
 * Extract token usage from Claude's stream-json output
 */
async function extractTokenUsage(outputFile: string): Promise<{ input: number; output: number }> {
  try {
    // Parse all JSON lines and find the result with usage info
    const content = await fs.readFile(outputFile, 'utf-8')
    const lines = content.split('\n').filter(line => line.trim().startsWith('{'))

    for (const line of lines) {
      try {
        const obj = JSON.parse(line)
        // Claude outputs usage in the result message
        if (obj.type === 'result' && obj.usage) {
          return {
            input: obj.usage.input_tokens || 0,
            output: obj.usage.output_tokens || 0
          }
        }
        // Also check for usage in message events
        if (obj.usage) {
          return {
            input: obj.usage.input_tokens || 0,
            output: obj.usage.output_tokens || 0
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  } catch {
    // File doesn't exist or can't be read
  }
  return { input: 0, output: 0 }
}

/**
 * Run Claude with the prompt
 */
async function runClaude(
  prompt: string,
  outputFile: string,
  timeoutSec: number,
  quiet: boolean = false
): Promise<ClaudeResult> {
  const promptFile = path.join(os.tmpdir(), `ralph-prompt-${randomUUID()}.md`)
  const startTime = Date.now()

  try {
    await fs.writeFile(promptFile, prompt)
    const timeoutMs = timeoutSec * 1000

    if (quiet) {
      await execAsync(
        `claude --dangerously-skip-permissions --print < "${promptFile}"`,
        { cwd: PROJECT_ROOT, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }
      )
    } else {
      // Streaming mode with JSON output
      const streamText = 'select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\\n"; "\\r\\n") | . + "\\r\\n\\n"'

      await execAsync(
        `claude --dangerously-skip-permissions --verbose --print --output-format stream-json < "${promptFile}" 2>&1 | grep --line-buffered '^{' | tee "${outputFile}" | jq --unbuffered -rj '${streamText}' 2>/dev/null || true`,
        { cwd: PROJECT_ROOT, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }
      )
    }

    const duration = Math.floor((Date.now() - startTime) / 1000)
    const tokens = await extractTokenUsage(outputFile)

    return {
      success: true,
      duration,
      inputTokens: tokens.input,
      outputTokens: tokens.output
    }
  } catch (error: any) {
    const duration = Math.floor((Date.now() - startTime) / 1000)
    const tokens = await extractTokenUsage(outputFile)

    return {
      success: false,
      duration,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      error: error.message
    }
  } finally {
    await fs.unlink(promptFile).catch(() => {})
  }
}

/**
 * Check story status from database (Claude calls /api/signal to update)
 */
function checkStoryStatus(storyId: string): { complete: boolean; blocked: boolean; message?: string } {
  const story = prdDb.stories.get(storyId)
  const runStateData = prdDb.runState.get()

  if (story?.passes) {
    return { complete: true, blocked: false }
  }

  if (runStateData.status === 'blocked') {
    return { complete: false, blocked: true, message: runStateData.last_error || undefined }
  }

  return { complete: false, blocked: false }
}

/**
 * Poll for story completion with timeout
 * Claude may take a moment to call the signal API after execution
 */
async function waitForSignal(
  storyId: string,
  timeoutMs: number = 30000,
  pollIntervalMs: number = 1000
): Promise<{ complete: boolean; blocked: boolean; message?: string }> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const status = checkStoryStatus(storyId)
    if (status.complete || status.blocked) {
      return status
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
  }

  // Timeout - check one final time
  return checkStoryStatus(storyId)
}

/**
 * Validate a story before implementation
 * Returns questions if clarification is needed
 */
export async function validateStory(story: Story): Promise<ValidationResult> {
  // Check for vague terms
  const vagueTerms = ['properly', 'correctly', 'appropriate', 'handle', 'improve', 'better', 'settings']
  const allText = [
    story.title,
    story.description || '',
    ...(story.acceptance || [])
  ].join(' ').toLowerCase()

  const foundVague = vagueTerms.filter(term => allText.includes(term))

  // Check for missing acceptance criteria
  const hasAcceptance = story.acceptance && story.acceptance.length > 0

  // Check for unclear scope
  const questions: string[] = []

  if (foundVague.length > 0) {
    questions.push(`The story contains vague terms: ${foundVague.join(', ')}. Can you clarify what exactly is expected?`)
  }

  if (!hasAcceptance) {
    questions.push('No acceptance criteria defined. What should be verified when the story is complete?')
  }

  if (!story.description && !story.intent) {
    questions.push('No description or intent provided. Can you clarify the context and goals?')
  }

  return {
    valid: questions.length === 0,
    questions: questions.length > 0 ? questions : undefined
  }
}

/**
 * Check if story has external dependencies
 */
export function hasExternalDeps(story: Story): boolean {
  return !!(story.external_deps && story.external_deps.length > 0)
}

/**
 * Main execution function - runs one iteration
 * Returns gate request if user input is needed
 */
export async function runIteration(
  prd: PRD,
  config: ExecutionConfig,
  gateResponse?: { type: GateType; response: any }
): Promise<{
  status: ExecutionStatus
  event?: ExecutionEvent
  gateRequest?: GateRequest
  storyId?: string
}> {
  const currentState = await state.readState()

  // Check if already working on a story
  let storyId = currentState.current_story
  let story: Story | undefined
  let branch: string | null | undefined = null

  // If resuming, get branch from the story
  if (storyId) {
    story = prd.stories.find(s => s.id === storyId)
    branch = story?.working_branch
  }

  if (!storyId) {
    // Select next story
    if (config.singleStoryId) {
      storyId = config.singleStoryId
      story = prd.stories.find(s => s.id === storyId)
      if (!story) {
        return {
          status: 'error',
          event: {
            type: 'error',
            timestamp: new Date().toISOString(),
            data: { message: `Story ${storyId} not found` }
          }
        }
      }
    } else {
      const nextStory = getNextStory(prd, currentState.last_completed)
      story = nextStory || undefined
      if (!story) {
        // Check if all complete
        const runnable = getRunnableStories(prd)
        if (runnable.length === 0) {
          const allComplete = prd.stories.every(s => s.merged || s.skipped)
          if (allComplete) {
            return {
              status: 'complete',
              event: {
                type: 'complete',
                timestamp: new Date().toISOString(),
                data: { message: 'All stories complete!' }
              }
            }
          }
          return {
            status: 'blocked',
            event: {
              type: 'log',
              timestamp: new Date().toISOString(),
              data: { message: 'No runnable stories (dependencies not met)' }
            }
          }
        }
        return {
          status: 'error',
          event: {
            type: 'error',
            timestamp: new Date().toISOString(),
            data: { message: 'No story selected' }
          }
        }
      }
      storyId = story.id
    }
  } else {
    story = prd.stories.find(s => s.id === storyId)
  }

  if (!story) {
    return {
      status: 'error',
      event: {
        type: 'error',
        timestamp: new Date().toISOString(),
        data: { message: `Story ${storyId} not found in PRD` }
      }
    }
  }

  // Check for external deps gate FIRST (cheap check, skip early if not ready)
  if (hasExternalDeps(story)) {
    const extDepsCheckpoint = await state.getCheckpoint(storyId, 'external_deps_complete')
    if (!extDepsCheckpoint && !gateResponse?.type?.includes('external_deps')) {
      return {
        status: 'external_deps_gate',
        storyId,
        gateRequest: {
          type: 'external_deps',
          storyId,
          data: {
            story,
            deps: story.external_deps
          }
        }
      }
    }
  }

  // Handle external deps gate response
  if (gateResponse?.type === 'external_deps') {
    if (gateResponse.response.action === 'skip') {
      return {
        status: 'selecting_story',
        event: {
          type: 'log',
          timestamp: new Date().toISOString(),
          data: { message: `Skipping ${storyId} (external deps not ready)` }
        }
      }
    }
    await state.saveCheckpoint(storyId, 'external_deps_complete', {
      externalDepsReport: gateResponse.response.report
    })
  }

  // Check for validation gate (only if proceeding with the story)
  const validationCheckpoint = await state.getCheckpoint(storyId, 'validation_complete')
  if (!validationCheckpoint && !gateResponse?.type?.includes('validation')) {
    const validation = await validateStory(story)
    if (!validation.valid) {
      if (config.autoMode) {
        // Auto-proceed with assumptions
        await state.saveCheckpoint(storyId, 'validation_complete', {
          clarification: 'Auto mode: Make reasonable assumptions based on codebase patterns.'
        })
      } else {
        return {
          status: 'validation_gate',
          storyId,
          gateRequest: {
            type: 'validation',
            storyId,
            data: {
              story,
              questions: validation.questions
            }
          }
        }
      }
    } else {
      await state.saveCheckpoint(storyId, 'validation_complete')
    }
  }

  // Handle validation gate response
  if (gateResponse?.type === 'validation') {
    if (gateResponse.response.action === 'skip') {
      return {
        status: 'selecting_story',
        event: {
          type: 'log',
          timestamp: new Date().toISOString(),
          data: { message: `Skipping ${storyId}, selecting next story...` }
        }
      }
    }
    await state.saveCheckpoint(storyId, 'validation_complete', {
      clarification: gateResponse.response.clarification
    })
  }

  // Create branch if needed
  const branchCheckpoint = await state.getCheckpoint(storyId, 'branch_created')
  if (!branch || !branchCheckpoint) {
    branch = git.buildBranchName(storyId)
    const branchResult = await git.createBranch(branch, config.baseBranch)
    if (!branchResult.success) {
      // Try checkout if branch exists
      const checkoutResult = await git.checkoutBranch(branch)
      if (!checkoutResult.success) {
        return {
          status: 'error',
          event: {
            type: 'error',
            timestamp: new Date().toISOString(),
            data: { message: `Failed to create/checkout branch: ${branchResult.error}` }
          }
        }
      }
    }
    await state.startStory(storyId, branch)
    await state.saveCheckpoint(storyId, 'branch_created', { branch })
  }

  // Run Claude
  const claudeCheckpoint = await state.getCheckpoint(storyId, 'claude_complete')
  if (!claudeCheckpoint) {
    await state.saveCheckpoint(storyId, 'claude_started')

    // Get any clarification/feedback from checkpoints
    const validationData = (await state.getCheckpoint(storyId, 'validation_complete'))?.data || {}
    const extDepsData = (await state.getCheckpoint(storyId, 'external_deps_complete'))?.data || {}

    const prompt = await buildPrompt(story, branch, currentState.attempts + 1, config.version, {
      clarification: validationData.clarification as string | undefined,
      externalDepsReport: extDepsData.externalDepsReport as string | undefined,
      previousFailure: currentState.last_error || undefined
    })

    const outputFile = path.join(os.tmpdir(), `ralph-output-${randomUUID()}.txt`)

    // Start execution log
    const execLogId = prdDb.executionLog.start(storyId, currentState.attempts + 1)

    const claudeResult = await runClaude(prompt, outputFile, config.claudeTimeout)

    if (!claudeResult.success) {
      // Log the failed execution with token usage
      prdDb.executionLog.fail(execLogId, claudeResult.error || 'Claude execution failed')
      await state.recordFailure(claudeResult.error || 'Claude execution failed')
      return {
        status: 'error',
        storyId,
        event: {
          type: 'error',
          timestamp: new Date().toISOString(),
          data: {
            message: claudeResult.error,
            duration: claudeResult.duration,
            inputTokens: claudeResult.inputTokens,
            outputTokens: claudeResult.outputTokens
          }
        }
      }
    }

    await fs.unlink(outputFile).catch(() => {})

    // Poll for signal from Claude (waits up to 30s for API call)
    const storyStatus = await waitForSignal(storyId, 30000, 1000)

    if (storyStatus.complete) {
      // Log successful execution with token usage
      prdDb.executionLog.complete(execLogId, {
        input: claudeResult.inputTokens,
        output: claudeResult.outputTokens
      }, claudeResult.duration)
      await state.saveCheckpoint(storyId, 'claude_complete')
      await state.clearFailure()
    } else if (storyStatus.blocked) {
      // Log blocked execution
      prdDb.executionLog.block(execLogId, storyStatus.message || 'Story blocked')
      return {
        status: 'blocked',
        storyId,
        event: {
          type: 'log',
          timestamp: new Date().toISOString(),
          data: { message: `Story blocked: ${storyStatus.message || 'Unknown reason'}` }
        }
      }
    } else {
      // No signal received - Claude may have exited without signaling
      // Still log the execution with token usage
      prdDb.executionLog.fail(execLogId, 'Claude exited without signaling completion')
      return {
        status: 'error',
        storyId,
        event: {
          type: 'error',
          timestamp: new Date().toISOString(),
          data: {
            message: 'Claude exited without signaling completion. Check if story was implemented.',
            inputTokens: claudeResult.inputTokens,
            outputTokens: claudeResult.outputTokens,
            duration: claudeResult.duration
          }
        }
      }
    }
  }

  // PR flow
  const prCheckpoint = await state.getCheckpoint(storyId, 'pr_created')
  if (!prCheckpoint) {
    // Check for changes
    const changes = await git.getChangedFiles()
    if (changes.length === 0) {
      return {
        status: 'error',
        storyId,
        event: {
          type: 'error',
          timestamp: new Date().toISOString(),
          data: { message: 'No changes to commit' }
        }
      }
    }

    // Stage and commit
    await git.stageAll()
    await git.commit(`feat(${storyId}): ${story.title}`)
    await git.push(branch)

    // Create PR
    const prBody = `## ${story.title}\n\n${story.intent || ''}\n\n### Acceptance Criteria\n${(story.acceptance || []).map(ac => `- [ ] ${ac}`).join('\n')}`
    const prResult = await git.createPR(
      `[${storyId}] ${story.title}`,
      prBody,
      config.baseBranch
    )

    if (prResult.success && prResult.url) {
      await state.setPrUrl(prResult.url)
      await state.saveCheckpoint(storyId, 'pr_created', { prUrl: prResult.url })

      if (!config.autoMode) {
        return {
          status: 'pr_gate',
          storyId,
          gateRequest: {
            type: 'pr_review',
            storyId,
            data: {
              story,
              prUrl: prResult.url
            }
          }
        }
      }

      // Auto-merge
      const mergeResult = await git.mergePR(branch)
      if (mergeResult.success) {
        await state.completeStory(storyId, prResult.url)
        await state.clearCheckpoints(storyId)

        if (config.oneShotMode) {
          return {
            status: 'complete',
            storyId,
            event: {
              type: 'complete',
              timestamp: new Date().toISOString(),
              data: { message: `Story ${storyId} complete!`, prUrl: prResult.url }
            }
          }
        }

        return {
          status: 'idle',
          event: {
            type: 'log',
            timestamp: new Date().toISOString(),
            data: { message: `Story ${storyId} merged!`, prUrl: prResult.url }
          }
        }
      }
    }
  }

  // Handle PR gate response
  if (gateResponse?.type === 'pr_review') {
    if (gateResponse.response.action === 'merge') {
      const mergeResult = await git.mergePR(branch!)
      if (mergeResult.success) {
        const checkpoint = await state.getCheckpoint(storyId, 'pr_created')
        await state.completeStory(storyId, checkpoint?.data?.prUrl as string | undefined)
        await state.clearCheckpoints(storyId)

        return {
          status: 'idle',
          event: {
            type: 'log',
            timestamp: new Date().toISOString(),
            data: { message: `Story ${storyId} merged!` }
          }
        }
      }
    } else if (gateResponse.response.action === 'feedback') {
      // Reset to run Claude again with feedback
      await state.incrementAttempt()
      // Store feedback in checkpoint
      const validationCheckpoint = await state.getCheckpoint(storyId, 'validation_complete')
      await state.saveCheckpoint(storyId, 'validation_complete', {
        ...validationCheckpoint?.data,
        feedback: gateResponse.response.feedback
      })
      // Clear claude checkpoint to re-run
      await state.clearCheckpoints(storyId)
      await state.saveCheckpoint(storyId, 'branch_created', { branch })
      await state.saveCheckpoint(storyId, 'validation_complete', {
        ...validationCheckpoint?.data,
        feedback: gateResponse.response.feedback
      })

      return {
        status: 'running_claude',
        storyId,
        event: {
          type: 'log',
          timestamp: new Date().toISOString(),
          data: { message: 'Re-running Claude with feedback...' }
        }
      }
    }
  }

  return { status: 'idle', storyId }
}

/**
 * Get execution status summary
 */
export async function getExecutionStatus(prd: PRD): Promise<{
  state: state.RunState
  progress: { total: number; merged: number; passed: number; percentage: number }
  nextStory: Story | null
  scoredStories: StoryScore[]
}> {
  const currentState = await state.readState()
  const nextStory = getNextStory(prd, currentState.last_completed)
  const scoredStories = getScoredStories(prd, currentState.last_completed)

  const total = prd.stories.length
  const merged = prd.stories.filter(s => s.merged).length
  const passed = prd.stories.filter(s => s.passes && !s.merged).length
  const percentage = total > 0 ? Math.round((merged / total) * 100) : 0

  return {
    state: currentState,
    progress: { total, merged, passed, percentage },
    nextStory,
    scoredStories
  }
}
