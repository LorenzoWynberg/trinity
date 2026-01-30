/**
 * Run State Management - Ported from CLI state.elv
 *
 * Handles reading AND writing state for the execution loop.
 * Tracks: current story, checkpoints, failure tracking, last completed
 */

import fs from 'fs/promises'
import path from 'path'

const PROJECT_ROOT = path.join(process.cwd(), '../../..')
const STATE_FILE = path.join(PROJECT_ROOT, 'tools/ralph/cli/state.json')

export type RunStatus = 'idle' | 'running' | 'paused' | 'waiting_gate' | 'blocked'

export type CheckpointStage =
  | 'external_deps_complete'
  | 'validation_complete'
  | 'branch_created'
  | 'claude_started'
  | 'claude_complete'
  | 'pr_created'

export interface Checkpoint {
  story_id: string
  stage: CheckpointStage
  at: string
  attempt: number
  data?: Record<string, unknown>
}

export interface RunState {
  version: number
  current_story: string | null
  status: RunStatus
  branch: string | null
  pr_url: string | null
  started_at: string | null
  last_updated: string | null
  attempts: number
  error: string | null
  checkpoints: Checkpoint[]
  // Smart selection
  last_completed: string | null
  // Failure tracking
  last_error: string | null
  failure_count: number
}

const DEFAULT_STATE: RunState = {
  version: 1,
  current_story: null,
  status: 'idle',
  branch: null,
  pr_url: null,
  started_at: null,
  last_updated: null,
  attempts: 0,
  error: null,
  checkpoints: [],
  last_completed: null,
  last_error: null,
  failure_count: 0
}

/**
 * Read current state from file
 */
export async function readState(): Promise<RunState> {
  try {
    const content = await fs.readFile(STATE_FILE, 'utf-8')
    const state = JSON.parse(content)
    return { ...DEFAULT_STATE, ...state }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

/**
 * Write state to file
 */
export async function writeState(state: Partial<RunState>): Promise<void> {
  const current = await readState()
  const updated: RunState = {
    ...current,
    ...state,
    last_updated: new Date().toISOString()
  }
  await fs.writeFile(STATE_FILE, JSON.stringify(updated, null, 2))
}

/**
 * Reset state to initial values (preserves last_completed)
 */
export async function resetState(): Promise<void> {
  const current = await readState()
  await writeState({
    ...DEFAULT_STATE,
    last_completed: current.last_completed // Preserve for context retention
  })
}

/**
 * Start working on a story
 */
export async function startStory(storyId: string, branch: string): Promise<void> {
  await writeState({
    current_story: storyId,
    status: 'running',
    branch,
    pr_url: null,
    started_at: new Date().toISOString(),
    attempts: 1,
    error: null
  })
}

/**
 * Mark story as complete and set as last_completed
 */
export async function completeStory(storyId: string, prUrl?: string): Promise<void> {
  await writeState({
    current_story: null,
    status: 'idle',
    branch: null,
    pr_url: prUrl || null,
    last_completed: storyId,
    attempts: 0,
    error: null,
    last_error: null,
    failure_count: 0,
    checkpoints: []
  })
}

/**
 * Update status
 */
export async function setStatus(status: RunStatus): Promise<void> {
  await writeState({ status })
}

/**
 * Save a checkpoint for resume capability
 */
export async function saveCheckpoint(
  storyId: string,
  stage: CheckpointStage,
  data?: Record<string, unknown>
): Promise<void> {
  const state = await readState()

  const checkpoint: Checkpoint = {
    story_id: storyId,
    stage,
    at: new Date().toISOString(),
    attempt: state.attempts,
    data
  }

  // Replace same-stage checkpoint, keep others
  const otherCheckpoints = state.checkpoints.filter(
    cp => !(cp.story_id === storyId && cp.stage === stage)
  )

  await writeState({
    checkpoints: [...otherCheckpoints, checkpoint]
  })
}

/**
 * Get checkpoint for a story at a specific stage
 */
export async function getCheckpoint(
  storyId: string,
  stage: CheckpointStage
): Promise<Checkpoint | null> {
  const state = await readState()
  return state.checkpoints.find(
    cp => cp.story_id === storyId && cp.stage === stage
  ) || null
}

/**
 * Clear all checkpoints for a story
 */
export async function clearCheckpoints(storyId: string): Promise<void> {
  const state = await readState()
  await writeState({
    checkpoints: state.checkpoints.filter(cp => cp.story_id !== storyId)
  })
}

/**
 * Record a failure with error message
 * Returns the failure count (for escalation logic)
 */
export async function recordFailure(errorMsg: string): Promise<number> {
  const state = await readState()

  // Increment if same error, reset if different
  const isSameError = state.last_error === errorMsg
  const newCount = isSameError ? state.failure_count + 1 : 1

  await writeState({
    last_error: errorMsg,
    failure_count: newCount,
    error: errorMsg
  })

  return newCount
}

/**
 * Clear failure tracking (on success or story change)
 */
export async function clearFailure(): Promise<void> {
  await writeState({
    last_error: null,
    failure_count: 0,
    error: null
  })
}

/**
 * Increment attempt counter
 */
export async function incrementAttempt(): Promise<number> {
  const state = await readState()
  const newAttempts = state.attempts + 1
  await writeState({ attempts: newAttempts })
  return newAttempts
}

/**
 * Set PR URL for current story
 */
export async function setPrUrl(prUrl: string): Promise<void> {
  await writeState({ pr_url: prUrl })
}
