/**
 * Run State Management - SQLite version
 *
 * Handles reading AND writing state for the execution loop.
 * Tracks: current story, checkpoints, failure tracking, last completed
 */

import * as prd from './db/prd'

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
 * Read current state from SQLite
 */
export async function readState(): Promise<RunState> {
  try {
    const dbState = prd.runState.get()
    return {
      ...DEFAULT_STATE,
      current_story: dbState.current_story,
      status: (dbState.status as RunStatus) || 'idle',
      branch: dbState.branch,
      pr_url: dbState.pr_url,
      attempts: dbState.attempts,
      last_completed: dbState.last_completed,
      last_error: dbState.last_error,
      error: dbState.last_error,
      // Checkpoints loaded separately
      checkpoints: []
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

/**
 * Write state to SQLite
 */
export async function writeState(state: Partial<RunState>): Promise<void> {
  prd.runState.update({
    current_story: state.current_story,
    status: state.status,
    branch: state.branch,
    pr_url: state.pr_url,
    attempts: state.attempts,
    last_completed: state.last_completed,
    last_error: state.last_error || state.error
  })
}

/**
 * Reset state to initial values (preserves last_completed)
 */
export async function resetState(): Promise<void> {
  const current = await readState()
  prd.runState.reset()
  // Restore last_completed for context retention
  if (current.last_completed) {
    prd.runState.update({ last_completed: current.last_completed })
  }
}

/**
 * Start working on a story
 */
export async function startStory(storyId: string, branch: string): Promise<void> {
  prd.runState.update({
    current_story: storyId,
    status: 'running',
    branch,
    pr_url: null,
    attempts: 1,
    last_error: null
  })
}

/**
 * Mark story as complete and set as last_completed
 */
export async function completeStory(storyId: string, prUrl?: string): Promise<void> {
  prd.runState.update({
    current_story: null,
    status: 'idle',
    branch: null,
    pr_url: prUrl || null,
    last_completed: storyId,
    attempts: 0,
    last_error: null
  })
  // Clear checkpoints for this story
  prd.checkpoints.clear(storyId)
}

/**
 * Update status
 */
export async function setStatus(status: RunStatus): Promise<void> {
  prd.runState.update({ status })
}

/**
 * Save a checkpoint for resume capability
 */
export async function saveCheckpoint(
  storyId: string,
  stage: CheckpointStage,
  data?: Record<string, unknown>
): Promise<void> {
  prd.checkpoints.save(storyId, stage, data)
}

/**
 * Get checkpoint for a story at a specific stage
 */
export async function getCheckpoint(
  storyId: string,
  stage: CheckpointStage
): Promise<Checkpoint | null> {
  const checkpoint = prd.checkpoints.get(storyId, stage)
  if (!checkpoint) return null

  const state = await readState()
  return {
    story_id: storyId,
    stage,
    at: new Date().toISOString(),
    attempt: state.attempts,
    data: checkpoint.data
  }
}

/**
 * Clear all checkpoints for a story
 */
export async function clearCheckpoints(storyId: string): Promise<void> {
  prd.checkpoints.clear(storyId)
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

  prd.runState.update({
    last_error: errorMsg
  })

  return newCount
}

/**
 * Clear failure tracking (on success or story change)
 */
export async function clearFailure(): Promise<void> {
  prd.runState.update({
    last_error: null
  })
}

/**
 * Increment attempt counter
 */
export async function incrementAttempt(): Promise<number> {
  const state = await readState()
  const newAttempts = state.attempts + 1
  prd.runState.update({ attempts: newAttempts })
  return newAttempts
}

/**
 * Set PR URL for current story
 */
export async function setPrUrl(prUrl: string): Promise<void> {
  prd.runState.update({ pr_url: prUrl })
}
