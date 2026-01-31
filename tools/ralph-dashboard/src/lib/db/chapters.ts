import { getDb } from './index'

export type Book = 'knowledge' | 'gotchas'

export type Chapter = {
  id: number
  book: Book
  slug: string
  title: string
  description: string | null
  icon: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

// List all chapters for a book
export function list(book: Book): Chapter[] {
  const db = getDb()
  return db.prepare(
    'SELECT * FROM chapters WHERE book = ? ORDER BY sort_order, title'
  ).all(book) as Chapter[]
}

// Get chapter by book and slug
export function get(book: Book, slug: string): Chapter | null {
  const db = getDb()
  return db.prepare(
    'SELECT * FROM chapters WHERE book = ? AND slug = ?'
  ).get(book, slug) as Chapter | undefined || null
}

// Get chapter by ID
export function getById(id: number): Chapter | null {
  const db = getDb()
  return db.prepare('SELECT * FROM chapters WHERE id = ?').get(id) as Chapter | undefined || null
}

// Create a chapter
export function create(data: {
  book: Book
  slug: string
  title: string
  description?: string
  icon?: string
  sort_order?: number
}): Chapter {
  const db = getDb()

  const result = db.prepare(`
    INSERT INTO chapters (book, slug, title, description, icon, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.book,
    data.slug,
    data.title,
    data.description || null,
    data.icon || null,
    data.sort_order || 0
  )

  return getById(result.lastInsertRowid as number)!
}

// Update a chapter
export function update(id: number, data: {
  title?: string
  description?: string
  icon?: string
  sort_order?: number
}): Chapter | null {
  const db = getDb()

  const updates: string[] = []
  const params: any[] = []

  if (data.title !== undefined) {
    updates.push('title = ?')
    params.push(data.title)
  }
  if (data.description !== undefined) {
    updates.push('description = ?')
    params.push(data.description)
  }
  if (data.icon !== undefined) {
    updates.push('icon = ?')
    params.push(data.icon)
  }
  if (data.sort_order !== undefined) {
    updates.push('sort_order = ?')
    params.push(data.sort_order)
  }

  if (updates.length === 0) return getById(id)

  updates.push("updated_at = datetime('now')")
  params.push(id)

  db.prepare(`UPDATE chapters SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  return getById(id)
}

// Delete a chapter (cascades to pages)
export function remove(id: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM chapters WHERE id = ?').run(id)
  return result.changes > 0
}

// Get or create a chapter
export function getOrCreate(book: Book, slug: string, title: string): Chapter {
  let chapter = get(book, slug)
  if (!chapter) {
    chapter = create({ book, slug, title })
  }
  return chapter
}
