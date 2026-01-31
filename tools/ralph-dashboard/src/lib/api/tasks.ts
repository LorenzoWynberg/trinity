import { api } from './client'

export interface Task {
  id: string
  type: string
  description: string
  status: 'pending' | 'running' | 'complete' | 'error'
  params?: Record<string, any>
  result?: any
  error?: string
  created_at: string
  updated_at: string
}

export const tasksApi = {
  // Get all tasks
  list: (limit?: number) =>
    api.get<{ tasks: Task[] }>(limit ? `/api/tasks?limit=${limit}` : '/api/tasks'),

  // Get single task
  get: (id: string) =>
    api.get<Task>(`/api/tasks/${id}`),

  // Create task
  create: (type: string, description: string, params?: Record<string, any>) =>
    api.post<Task>('/api/tasks', { type, description, params }),

  // Clear completed tasks
  clear: () =>
    api.post<{ cleared: number }>('/api/tasks/clear', {}),
}
