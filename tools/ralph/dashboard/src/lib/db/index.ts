import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'dashboard.db')
const MIGRATIONS_DIR = path.join(process.cwd(), 'src/lib/db/migrations')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
  }
  return db
}

function runMigrations(db: Database.Database) {
  // Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Get applied migrations
  const applied = new Set(
    db.prepare('SELECT name FROM migrations').all().map((r: any) => r.name)
  )

  // Read migration files
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) continue

    console.log(`[db] Running migration: ${file}`)
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')

    db.transaction(() => {
      // Split by semicolons and run each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      for (const stmt of statements) {
        db.exec(stmt)
      }

      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file)
    })()

    console.log(`[db] Applied migration: ${file}`)
  }
}

// Task types
export type TaskType = 'refine' | 'generate' | 'story-edit'
export type TaskStatus = 'queued' | 'running' | 'complete' | 'failed'

export interface Task {
  id: string
  type: TaskType
  status: TaskStatus
  version: string
  params: Record<string, any>
  result?: any
  error?: string
  created_at: string
  started_at?: string
  completed_at?: string
}

// Parse JSON fields from DB row
function parseTask(row: any): Task {
  return {
    ...row,
    params: JSON.parse(row.params || '{}'),
    result: row.result ? JSON.parse(row.result) : undefined,
  }
}

// Task operations
export const tasks = {
  create(type: TaskType, version: string, params: Record<string, any> = {}): Task {
    const db = getDb()
    const id = crypto.randomUUID()

    db.prepare(`
      INSERT INTO tasks (id, type, version, params)
      VALUES (?, ?, ?, ?)
    `).run(id, type, version, JSON.stringify(params))

    return this.get(id)!
  },

  get(id: string): Task | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    return row ? parseTask(row) : null
  },

  list(options: {
    type?: TaskType
    status?: TaskStatus | TaskStatus[]
    limit?: number
  } = {}): Task[] {
    const db = getDb()
    let sql = 'SELECT * FROM tasks WHERE 1=1'
    const params: any[] = []

    if (options.type) {
      sql += ' AND type = ?'
      params.push(options.type)
    }

    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status]
      sql += ` AND status IN (${statuses.map(() => '?').join(', ')})`
      params.push(...statuses)
    }

    sql += ' ORDER BY created_at DESC'

    if (options.limit) {
      sql += ' LIMIT ?'
      params.push(options.limit)
    }

    return db.prepare(sql).all(...params).map(parseTask)
  },

  getActive(): Task[] {
    return this.list({ status: ['queued', 'running'] })
  },

  getNext(): Task | null {
    const db = getDb()
    // Get next queued task if nothing is running
    const running = db.prepare('SELECT id FROM tasks WHERE status = ?').get('running')
    if (running) return null

    const row = db.prepare(`
      SELECT * FROM tasks
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1
    `).get()

    return row ? parseTask(row) : null
  },

  start(id: string): Task | null {
    const db = getDb()
    db.prepare(`
      UPDATE tasks
      SET status = 'running', started_at = datetime('now')
      WHERE id = ?
    `).run(id)
    return this.get(id)
  },

  complete(id: string, result: any): Task | null {
    const db = getDb()
    db.prepare(`
      UPDATE tasks
      SET status = 'complete', result = ?, completed_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(result), id)
    return this.get(id)
  },

  fail(id: string, error: string): Task | null {
    const db = getDb()
    db.prepare(`
      UPDATE tasks
      SET status = 'failed', error = ?, completed_at = datetime('now')
      WHERE id = ?
    `).run(error, id)
    return this.get(id)
  },

  cleanup(keepCount: number = 50): number {
    const db = getDb()
    // Delete old completed/failed tasks beyond keepCount
    const result = db.prepare(`
      DELETE FROM tasks
      WHERE id IN (
        SELECT id FROM tasks
        WHERE status IN ('complete', 'failed')
        ORDER BY created_at DESC
        LIMIT -1 OFFSET ?
      )
    `).run(keepCount)
    return result.changes
  }
}
