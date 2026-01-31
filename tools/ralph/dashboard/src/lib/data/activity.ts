import fs from 'fs/promises'
import path from 'path'

const PROJECT_ROOT = path.join(process.cwd(), '../../..')
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs')

export type ActivityProject = 'trinity' | 'ralph'

export async function getActivityLogs(project: ActivityProject = 'trinity'): Promise<{ date: string; content: string; archived: boolean }[]> {
  try {
    const activityDir = path.join(LOGS_DIR, 'activity', project)
    const archiveDir = path.join(activityDir, 'archive')
    const logs: { date: string; content: string; archived: boolean }[] = []

    // Read recent logs from project directory
    try {
      const files = await fs.readdir(activityDir)
      const mdFiles = files.filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))

      for (const file of mdFiles) {
        const content = await fs.readFile(path.join(activityDir, file), 'utf-8')
        logs.push({
          date: file.replace('.md', ''),
          content,
          archived: false
        })
      }
    } catch {
      // Directory might not exist yet
    }

    // Read archived logs from archive/YYYY-MM/ subdirectories
    try {
      const archiveMonths = await fs.readdir(archiveDir)
      for (const month of archiveMonths) {
        if (!month.match(/^\d{4}-\d{2}$/)) continue
        const monthDir = path.join(archiveDir, month)
        const stat = await fs.stat(monthDir)
        if (!stat.isDirectory()) continue

        const archivedFiles = await fs.readdir(monthDir)
        for (const file of archivedFiles) {
          if (!file.match(/^\d{4}-\d{2}-\d{2}\.md$/)) continue
          const content = await fs.readFile(path.join(monthDir, file), 'utf-8')
          logs.push({
            date: file.replace('.md', ''),
            content,
            archived: true
          })
        }
      }
    } catch {
      // Archive directory might not exist yet
    }

    return logs.sort((a, b) => b.date.localeCompare(a.date))
  } catch {
    return []
  }
}

export async function getActivityProjects(): Promise<ActivityProject[]> {
  try {
    const activityDir = path.join(LOGS_DIR, 'activity')
    const entries = await fs.readdir(activityDir, { withFileTypes: true })
    const projects = entries
      .filter(e => e.isDirectory() && ['trinity', 'ralph'].includes(e.name))
      .map(e => e.name as ActivityProject)
      .sort((a) => a === 'trinity' ? -1 : 1) // Trinity first
    return projects.length > 0 ? projects : ['trinity']
  } catch {
    return ['trinity']
  }
}
