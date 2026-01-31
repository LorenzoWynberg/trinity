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
      // Remove comments and split by semicolons
      const cleanSql = sql
        .split('\n')
        .map(line => line.replace(/--.*$/, '').trim())
        .join('\n')

      const statements = cleanSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      for (const stmt of statements) {
        db.exec(stmt)
      }

      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file)
    })()

    console.log(`[db] Applied migration: ${file}`)
  }
}

// Task types
export type TaskType = 'refine' | 'generate' | 'story-edit' | 'align'
export type TaskStatus = 'queued' | 'running' | 'complete' | 'failed'

export interface TaskContext {
  returnPath?: string      // Where to navigate when task completes
  step?: string            // Which step to resume at
  tempFile?: string        // Path to temp file if needed
  selectedIds?: string[]   // Pre-selected items
  [key: string]: any       // Additional context
}

export interface Task {
  id: string
  type: TaskType
  status: TaskStatus
  version: string
  params: Record<string, any>
  context?: TaskContext
  result?: any
  error?: string
  created_at: string
  started_at?: string
  completed_at?: string
  read_at?: string
  deleted_at?: string
}

// Parse JSON fields from DB row
function parseTask(row: any): Task {
  return {
    ...row,
    params: JSON.parse(row.params || '{}'),
    context: row.context ? JSON.parse(row.context) : undefined,
    result: row.result ? JSON.parse(row.result) : undefined,
  }
}

// Task operations
export const tasks = {
  create(type: TaskType, version: string, params: Record<string, any> = {}, context?: TaskContext): Task {
    const db = getDb()
    const id = crypto.randomUUID()

    db.prepare(`
      INSERT INTO tasks (id, type, version, params, context)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, type, version, JSON.stringify(params), context ? JSON.stringify(context) : null)

    return this.get(id)!
  },

  updateContext(id: string, context: TaskContext): Task | null {
    const db = getDb()
    db.prepare(`
      UPDATE tasks SET context = ? WHERE id = ?
    `).run(JSON.stringify(context), id)
    return this.get(id)
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
    includeDeleted?: boolean
    includeRead?: boolean
  } = {}): Task[] {
    const db = getDb()
    let sql = 'SELECT * FROM tasks WHERE 1=1'
    const params: any[] = []

    // Exclude soft-deleted by default
    if (!options.includeDeleted) {
      sql += ' AND deleted_at IS NULL'
    }

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
  },

  delete(id: string): boolean {
    const db = getDb()
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
    return result.changes > 0
  },

  markRead(id: string): Task | null {
    const db = getDb()
    db.prepare(`
      UPDATE tasks SET read_at = datetime('now') WHERE id = ?
    `).run(id)
    return this.get(id)
  },

  markAllRead(): number {
    const db = getDb()
    const result = db.prepare(`
      UPDATE tasks
      SET read_at = datetime('now')
      WHERE read_at IS NULL
        AND status IN ('complete', 'failed')
        AND deleted_at IS NULL
    `).run()
    return result.changes
  },

  softDelete(id: string): Task | null {
    const db = getDb()
    db.prepare(`
      UPDATE tasks SET deleted_at = datetime('now') WHERE id = ?
    `).run(id)
    return this.get(id)
  },

  restore(id: string): Task | null {
    const db = getDb()
    db.prepare(`
      UPDATE tasks SET deleted_at = NULL WHERE id = ?
    `).run(id)
    return this.get(id)
  },

  getUnreadCount(): number {
    const db = getDb()
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE read_at IS NULL
        AND status IN ('complete', 'failed')
        AND deleted_at IS NULL
    `).get() as { count: number }
    return result.count
  }
}

// Settings operations
export const settings = {
  get(key: string): string | null {
    const db = getDb()
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  },

  getAll(): Record<string, string> {
    const db = getDb()
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  },

  set(key: string, value: string): void {
    const db = getDb()
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
    `).run(key, value, value)
  },

  setAll(data: Record<string, string>): void {
    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
    `)

    db.transaction(() => {
      for (const [key, value] of Object.entries(data)) {
        stmt.run(key, value, value)
      }
    })()
  },

  delete(key: string): void {
    const db = getDb()
    db.prepare('DELETE FROM settings WHERE key = ?').run(key)
  },

  clear(): void {
    const db = getDb()
    db.prepare('DELETE FROM settings').run()
  }
}
