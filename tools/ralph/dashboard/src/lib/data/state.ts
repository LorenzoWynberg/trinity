import * as prdDb from '../db/prd'
import type { State, RunStatus } from '../types'

export async function getState(): Promise<State | null> {
  try {
    const state = prdDb.runState.get()
    // Get current story to fetch branch/pr_url from it
    const currentStory = state.current_story ? prdDb.stories.get(state.current_story) : null

    return {
      version: 1,
      current_story: state.current_story,
      status: (state.status as RunStatus) || 'idle',
      error: state.last_error,
      started_at: null,
      branch: currentStory?.working_branch || null,
      attempts: state.attempts,
      pr_url: currentStory?.pr_url || null,
      last_updated: null,
      checkpoints: []
    }
  } catch {
    return null
  }
}
