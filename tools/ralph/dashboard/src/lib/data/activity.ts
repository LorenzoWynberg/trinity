// Activity logs - now backed by SQLite
// Re-export from db module for backwards compatibility

import * as activityDb from '@/lib/db/activity'

export type ActivityProject = 'trinity' | 'ralph'

export type ActivityLog = activityDb.ActivityLog

// For backwards compat with existing API - converts to old format
export async function getActivityLogs(project: ActivityProject = 'ralph'): Promise<{ date: string; content: string; archived: boolean }[]> {
  const logs = activityDb.list(project)

  // Group by date and combine content
  const byDate = new Map<string, string[]>()
  for (const log of logs) {
    const existing = byDate.get(log.date) || []
    const entry = formatLogEntry(log)
    existing.push(entry)
    byDate.set(log.date, existing)
  }

  return Array.from(byDate.entries())
    .map(([date, entries]) => ({
      date,
      content: entries.join('\n\n---\n\n'),
      archived: false
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

function formatLogEntry(log: activityDb.ActivityLog): string {
  let md = `## ${log.title}\n\n`
  if (log.time) md += `**Time:** ${log.time}\n\n`
  if (log.content) md += `${log.content}\n\n`
  if (log.files_changed?.length) {
    md += `### Files modified\n${log.files_changed.map(f => `- \`${f}\``).join('\n')}\n\n`
  }
  if (log.files_created?.length) {
    md += `### Files created\n${log.files_created.map(f => `- \`${f}\``).join('\n')}\n\n`
  }
  return md.trim()
}

export async function getActivityProjects(): Promise<ActivityProject[]> {
  return activityDb.getProjects()
}

// New functions using SQLite directly
export function listLogs(project?: ActivityProject, limit?: number) {
  return activityDb.list(project, limit)
}

export function createLog(log: Parameters<typeof activityDb.create>[0]) {
  return activityDb.create(log)
}

export function getLogsByStory(storyId: string) {
  return activityDb.getByStory(storyId)
}
