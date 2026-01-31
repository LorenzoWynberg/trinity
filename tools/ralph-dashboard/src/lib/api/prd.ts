import { api } from './client'
import type { PRD, Story, VersionInfo } from '../types'

export interface RefineResult {
  refinements: {
    id: string
    title: string
    status: 'ok' | 'needs_work'
    issues: string[]
    suggested_description: string
    suggested_acceptance: string[]
    tags?: string[]
    depends_on?: string[]
  }[]
  summary: string
}

export interface StoryAnalysis {
  storyId: string
  currentStory: Story
  relatedStories: { id: string; title: string }[]
  target: {
    suggested_description: string
    suggested_acceptance: string[]
    suggested_intent?: string
  }
  related_updates: {
    id: string
    title?: string
    reason: string
    suggested_description?: string
    suggested_acceptance?: string[]
  }[]
  summary: string
}

export interface GenerateResult {
  stories: {
    title: string
    intent: string
    acceptance: string[]
    phase: number
    epic: number
    depends_on: string[]
    tags: string[]
  }[]
  new_epic?: {
    needed: boolean
    phase: number
    name: string
    description: string
  }
  reasoning: string
}

export const prdApi = {
  // Get PRD for a version
  get: (version?: string) =>
    api.get<PRD>(version ? `/api/prd?version=${version}` : '/api/prd'),

  // Get single story
  getStory: (id: string) =>
    api.get<Story>(`/api/story/${encodeURIComponent(id)}`),

  // Get all versions
  getVersions: () =>
    api.get<{ versions: string[] }>('/api/versions'),

  // Get versions with progress
  getVersionsWithProgress: () =>
    api.get<{ versions: string[]; progress: VersionInfo[] }>('/api/versions'),

  // Refine stories
  refine: (version: string, storyId?: string) =>
    api.post<RefineResult>('/api/prd/refine', { version, storyId }),

  // Apply refinements
  applyRefinements: (version: string, refinements: any[]) =>
    api.put<{ applied: number; success: boolean }>('/api/prd/refine', { version, refinements }),

  // Edit refinement with feedback
  editRefinement: (params: {
    storyId: string
    title?: string
    currentDescription?: string
    currentAcceptance?: string[]
    userFeedback: string
    tags?: string[]
    depends_on?: string[]
    allRefinements?: any[]
  }) => api.post<{
    target: { id: string; suggested_description: string; suggested_acceptance: string[] }
    related_updates: any[]
  }>('/api/prd/refine/edit', params),

  // Analyze story changes
  analyzeStory: (version: string, storyId: string, requestedChanges: string) =>
    api.post<StoryAnalysis>('/api/prd/story', { version, storyId, requestedChanges }),

  // Apply story updates
  applyStoryUpdates: (version: string, updates: any[]) =>
    api.put<{ applied: number; success: boolean }>('/api/prd/story', { version, updates }),

  // Generate new stories
  generate: (version: string, description: string) =>
    api.post<GenerateResult>('/api/prd/generate', { version, description }),

  // Add generated stories
  addStories: (version: string, stories: any[]) =>
    api.put<{ added: number; success: boolean; stories: { id: string; title: string }[] }>(
      '/api/prd/generate',
      { version, stories }
    ),

  // Align - refine analysis with additional input
  refineAlign: (params: {
    version: string
    previousAnalysis: any
    additionalInput: string
    scope: string
    scopeId?: string
  }) => api.post<any>('/api/prd/align/refine', params),

  // Apply alignment changes
  applyAlignChanges: (version: string, changes: {
    modifications?: any[]
    newStories?: any[]
    removals?: string[]
  }) => api.put<{ applied: number; added: number; removed: number; success: boolean }>(
    '/api/prd/align',
    { version, ...changes }
  ),
}
