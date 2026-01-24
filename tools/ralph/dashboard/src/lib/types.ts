// PRD Types
export interface Story {
  id: string
  title: string
  intent?: string
  acceptance: string[]
  phase: number
  epic: number
  story_number: number
  depends_on?: string[]
  passes?: boolean
  merged?: boolean
  skipped?: boolean
  skip_reason?: string
  merge_commit?: string
  pr_url?: string
  target_version?: string
}

export interface PRD {
  project: string
  version: string
  stories: Story[]
}

// Version info for multi-version support
export interface VersionInfo {
  version: string
  total: number
  merged: number
  passed: number
  skipped: number
  percentage: number
}

// State Types
export interface State {
  version: number
  current_story: string | null
  status: 'idle' | 'in_progress' | 'blocked'
  branch: string | null
  pr_url: string | null
  started_at: string | null
  last_updated: string | null
  attempts: number
  error: string | null
  checkpoints: string[]
}

// Metrics Types
export interface StoryMetric {
  story_id: string
  timestamp: string
  duration_seconds: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

export interface Metrics {
  total_tokens: number
  total_input_tokens: number
  total_output_tokens: number
  total_duration_seconds: number
  stories_completed: number
  stories: StoryMetric[]
}

// Computed Types
export interface PhaseProgress {
  phase: number
  total: number
  merged: number
  passed: number
  skipped: number
  percentage: number
}

export interface EpicProgress {
  phase: number
  epic: number
  total: number
  merged: number
  stories: Story[]
}

export type StoryStatus = 'pending' | 'in_progress' | 'passed' | 'merged' | 'skipped' | 'blocked'

export function getStoryStatus(story: Story, currentStoryId: string | null): StoryStatus {
  if (story.skipped) return 'skipped'
  if (story.merged) return 'merged'
  if (story.passes) return 'passed'
  if (story.id === currentStoryId) return 'in_progress'
  return 'pending'
}
