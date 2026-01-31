'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Settings } from '@/lib/api/settings'

// Query keys - centralized for easy invalidation
export const queryKeys = {
  settings: ['settings'] as const,
  versions: ['versions'] as const,
  prd: (version?: string) => ['prd', version] as const,
  story: (id: string) => ['story', id] as const,
  runState: ['runState'] as const,
  metrics: ['metrics'] as const,
}

// ============ Settings ============

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => api.settings.get(),
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (settings: Partial<Settings>) => api.settings.update(settings),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.settings, data)
    },
  })
}

// ============ PRD / Versions ============

export function useVersions() {
  return useQuery({
    queryKey: queryKeys.versions,
    queryFn: () => api.prd.getVersionsWithProgress(),
  })
}

export function usePrd(version?: string) {
  return useQuery({
    queryKey: queryKeys.prd(version),
    queryFn: () => api.prd.get(version),
  })
}

export function useStory(id: string) {
  return useQuery({
    queryKey: queryKeys.story(id),
    queryFn: () => api.prd.getStory(id),
    enabled: !!id,
  })
}

// ============ Run State ============

export function useRunState() {
  return useQuery({
    queryKey: queryKeys.runState,
    queryFn: () => api.run.getState(),
    // Only poll when running - otherwise rely on SSE/signals
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'running' ? 2000 : false
    },
  })
}

export function useExecutionStatus(version: string) {
  return useQuery({
    queryKey: ['executionStatus', version] as const,
    queryFn: () => api.run.getExecutionStatus(version),
    enabled: !!version,
    // Poll when running, otherwise rely on SSE
    refetchInterval: (query) => {
      const status = query.state.data?.state?.status
      return status === 'running' ? 2000 : false
    },
  })
}

// ============ Metrics ============

export function useMetrics() {
  return useQuery({
    queryKey: queryKeys.metrics,
    queryFn: () => api.metrics.get(),
    // Metrics don't need frequent updates
    staleTime: 60 * 1000,
  })
}

// ============ Invalidation helpers ============

export function useInvalidate() {
  const queryClient = useQueryClient()

  return {
    prd: (version?: string) =>
      queryClient.invalidateQueries({ queryKey: version ? queryKeys.prd(version) : ['prd'] }),
    runState: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.runState }),
    metrics: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.metrics }),
    all: () =>
      queryClient.invalidateQueries(),
  }
}
