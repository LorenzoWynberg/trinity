import * as prdDb from '../db/prd'
import type { Metrics } from '../types'

export async function getMetrics(): Promise<Metrics | null> {
  try {
    const totals = prdDb.executionLog.getTotals()
    const allStories = prdDb.stories.list()
    const passedCount = allStories.filter(s => s.passes).length
    const mergedCount = allStories.filter(s => s.merged).length

    return {
      total_tokens: totals.total_input_tokens + totals.total_output_tokens,
      total_input_tokens: totals.total_input_tokens,
      total_output_tokens: totals.total_output_tokens,
      total_duration_seconds: totals.total_duration_seconds,
      stories_passed: passedCount,
      stories_prd: allStories.length,
      stories_merged: mergedCount,
      stories: [] // Per-story metrics derived from execution_log if needed
    }
  } catch {
    return null
  }
}
