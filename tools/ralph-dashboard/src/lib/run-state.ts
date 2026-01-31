/**
 * Run State Management - SQLite version
 *
 * Handles reading AND writing state for the execution loop.
 * Git details (branch, pr_url) now live on the story itself.
 */

import * as prd from './db/prd'
import type { RunStatus } from './types'

export type { RunStatus }

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
      attempts: dbState.attempts,
      last_completed: dbState.last_completed,
      last_error: dbState.last_error,
      error: dbState.last_error,
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
  if (current.last_completed) {
    prd.runState.update({ last_completed: current.last_completed })
  }
}

/**
 * Start working on a story
 */
export async function startStory(storyId: string, workingBranch: string): Promise<void> {
  // Update run state
  prd.runState.update({
    current_story: storyId,
    status: 'running',
    attempts: 1,
    last_error: null
  })
  // Set working branch on the story
  prd.stories.setWorkingBranch(storyId, workingBranch)
}

/**
 * Mark story as complete and set as last_completed
 */
export async function completeStory(storyId: string, prUrl?: string): Promise<void> {
  // Update story with PR URL if provided
  if (prUrl) {
    prd.stories.setPrUrl(storyId, prUrl)
  }
  // Reset run state
  prd.runState.update({
    current_story: null,
    status: 'idle',
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
 */
export async function recordFailure(errorMsg: string): Promise<number> {
  const state = await readState()
  const isSameError = state.last_error === errorMsg
  const newCount = isSameError ? state.failure_count + 1 : 1

  prd.runState.update({
    last_error: errorMsg
  })

  return newCount
}

/**
 * Clear failure tracking
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
 * Set PR URL for current story (wrapper for compatibility)
 */
export async function setPrUrl(prUrl: string): Promise<void> {
  const state = await readState()
  if (state.current_story) {
    prd.stories.setPrUrl(state.current_story, prUrl)
  }
}
