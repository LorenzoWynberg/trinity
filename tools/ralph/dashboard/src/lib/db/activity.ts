import { getDb } from './index'

export type ActivityProject = 'trinity' | 'ralph'

export type ActivityLog = {
  id: number
  project: ActivityProject
  date: string
  time: string | null
  title: string
  content: string | null
  status: string
  files_changed: string[] | null
  files_created: string[] | null
  tags: string[] | null
  story_id: string | null
  created_at: string
}

type ActivityLogRow = {
  id: number
  project: string
  date: string
  time: string | null
  title: string
  content: string | null
  status: string
  files_changed: string | null
  files_created: string | null
  tags: string | null
  story_id: string | null
  created_at: string
}

function parseRow(row: ActivityLogRow): ActivityLog {
  return {
    ...row,
    project: row.project as ActivityProject,
    files_changed: row.files_changed ? JSON.parse(row.files_changed) : null,
    files_created: row.files_created ? JSON.parse(row.files_created) : null,
    tags: row.tags ? JSON.parse(row.tags) : null,
  }
}

export function list(project?: ActivityProject, limit = 100): ActivityLog[] {
  const db = getDb()

  let query = 'SELECT * FROM activity_logs'
  const params: any[] = []

  if (project) {
    query += ' WHERE project = ?'
    params.push(project)
  }

  query += ' ORDER BY date DESC, created_at DESC LIMIT ?'
  params.push(limit)

  const rows = db.prepare(query).all(...params) as ActivityLogRow[]
  return rows.map(parseRow)
}

export function getByDate(date: string, project?: ActivityProject): ActivityLog[] {
  const db = getDb()

  let query = 'SELECT * FROM activity_logs WHERE date = ?'
  const params: any[] = [date]

  if (project) {
    query += ' AND project = ?'
    params.push(project)
  }

  query += ' ORDER BY created_at DESC'

  const rows = db.prepare(query).all(...params) as ActivityLogRow[]
  return rows.map(parseRow)
}

export function getByStory(storyId: string): ActivityLog[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM activity_logs WHERE story_id = ? ORDER BY created_at DESC'
  ).all(storyId) as ActivityLogRow[]
  return rows.map(parseRow)
}

export function create(log: {
  project?: ActivityProject
  date?: string
  time?: string
  title: string
  content?: string
  status?: string
  files_changed?: string[]
  files_created?: string[]
  tags?: string[]
  story_id?: string
}): ActivityLog {
  const db = getDb()

  const date = log.date || new Date().toISOString().split('T')[0]

  const result = db.prepare(`
    INSERT INTO activity_logs (project, date, time, title, content, status, files_changed, files_created, tags, story_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    log.project || 'ralph',
    date,
    log.time || null,
    log.title,
    log.content || null,
    log.status || 'complete',
    log.files_changed ? JSON.stringify(log.files_changed) : null,
    log.files_created ? JSON.stringify(log.files_created) : null,
    log.tags ? JSON.stringify(log.tags) : null,
    log.story_id || null
  )

  const row = db.prepare('SELECT * FROM activity_logs WHERE id = ?').get(result.lastInsertRowid) as ActivityLogRow
  return parseRow(row)
}

export function getProjects(): ActivityProject[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT DISTINCT project FROM activity_logs ORDER BY project'
  ).all() as { project: string }[]

  const projects = rows.map(r => r.project as ActivityProject)

  // Always include ralph even if no logs yet
  if (!projects.includes('ralph')) {
    projects.unshift('ralph')
  }

  return projects
}
