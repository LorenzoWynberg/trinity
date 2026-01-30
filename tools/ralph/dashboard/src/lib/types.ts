// PRD Types
export interface Story {
  id: string
  title: string
  intent?: string
  description?: string
  acceptance: string[]
  phase: number
  epic: number
  story_number: number
  depends_on?: string[]
  passes?: boolean
  merged?: boolean
  skipped?: boolean
  skip_reason?: string
  target_branch?: string
  working_branch?: string
  merge_commit?: string
  pr_url?: string
  target_version?: string
  external_deps?: { name: string; description: string }[]
  external_deps_report?: string
  // Smart selection fields
  priority?: number  // User-defined priority (0-10), higher = more important
  tags?: string[]    // Tags for cross-cutting concerns and clustering
  // Enriched fields (added at load time)
  phase_name?: string
  epic_name?: string
}

export interface Phase {
  id: number
  name: string
}

export interface Epic {
  phase: number
  id: number
  name: string
}

export interface PRD {
  project: string
  version: string
  title?: string
  shortTitle?: string
  description?: string
  phases?: Phase[]
  epics?: Epic[]
  stories: Story[]
}

// Version info for multi-version support
export interface VersionInfo {
  version: string
  title?: string
  shortTitle?: string
  description?: string
  total: number
  merged: number
  passed: number
  skipped: number
  percentage: number
}

// State Types
export type RunStatus = 'idle' | 'running' | 'paused' | 'waiting_gate' | 'blocked'

export interface State {
  version: number
  current_story: string | null
  status: RunStatus
  branch: string | null
  pr_url: string | null
  started_at: string | null
  last_updated: string | null
  attempts: number
  error: string | null
  checkpoints: string[]
  // Smart selection fields
  last_completed?: string | null  // Last merged story (for context retention scoring)
  // Failure tracking
  last_error?: string | null      // Most recent error message
  failure_count?: number          // Consecutive failures with same error
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
  stories_passed: number
  stories_prd: number
  stories_merged: number
  stories: StoryMetric[]
}

// Computed Types
export interface PhaseProgress {
  phase: number
  name?: string
  total: number
  merged: number
  passed: number
  skipped: number
  percentage: number
}

export interface EpicProgress {
  phase: number
  epic: number
  phaseName?: string
  epicName?: string
  total: number
  merged: number
  stories: Story[]
}

export type StoryStatus = 'pending' | 'in_progress' | 'passed' | 'merged' | 'skipped' | 'blocked'

export interface BlockedInfo {
  story: Story
  blockedBy: string
  blockerStory?: Story
}

export function getStoryStatus(story: Story, currentStoryId: string | null): StoryStatus {
  if (story.skipped) return 'skipped'
  if (story.merged) return 'merged'
  if (story.passes) return 'passed'
  if (story.id === currentStoryId) return 'in_progress'
  return 'pending'
}

// Knowledge Base Types
export interface ChapterPageMeta {
  slug: string        // filename without .md
  title: string       // display title for navigation
}

export interface ChapterIndex {
  title: string       // chapter display name
  description?: string
  icon?: string       // lucide icon name
  pages: ChapterPageMeta[]
}

export interface KnowledgePage {
  slug: string
  title: string
  content: string     // raw markdown
}

export interface KnowledgeChapter {
  slug: string        // folder name
  index: ChapterIndex // from index.json
  pages: KnowledgePage[]
}
