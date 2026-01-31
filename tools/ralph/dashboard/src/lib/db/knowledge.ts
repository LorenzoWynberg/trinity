import { getDb } from './index'
import * as tags from './tags'

export type KnowledgeCategory = 'knowledge' | 'gotcha'

export type Knowledge = {
  id: number
  category: KnowledgeCategory
  slug: string | null
  title: string
  content: string | null
  story_id: string | null
  source: string | null
  created_at: string
  updated_at: string
  tags?: string[]
}

type KnowledgeRow = Omit<Knowledge, 'tags'>

// List all knowledge/gotchas
export function list(category?: KnowledgeCategory): Knowledge[] {
  const db = getDb()

  let query = 'SELECT * FROM knowledge'
  const params: any[] = []

  if (category) {
    query += ' WHERE category = ?'
    params.push(category)
  }

  query += ' ORDER BY created_at DESC'

  const rows = db.prepare(query).all(...params) as KnowledgeRow[]

  return rows.map(row => ({
    ...row,
    tags: tags.getForKnowledge(row.id).map(t => t.name)
  }))
}

// Get by ID
export function get(id: number): Knowledge | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM knowledge WHERE id = ?').get(id) as KnowledgeRow | undefined

  if (!row) return null

  return {
    ...row,
    tags: tags.getForKnowledge(row.id).map(t => t.name)
  }
}

// Get by slug
export function getBySlug(slug: string): Knowledge | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM knowledge WHERE slug = ?').get(slug) as KnowledgeRow | undefined

  if (!row) return null

  return {
    ...row,
    tags: tags.getForKnowledge(row.id).map(t => t.name)
  }
}

// Get knowledge linked to a story
export function getByStory(storyId: string): Knowledge[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM knowledge WHERE story_id = ? ORDER BY created_at DESC'
  ).all(storyId) as KnowledgeRow[]

  return rows.map(row => ({
    ...row,
    tags: tags.getForKnowledge(row.id).map(t => t.name)
  }))
}

// Create new knowledge
export function create(data: {
  category: KnowledgeCategory
  title: string
  slug?: string
  content?: string
  story_id?: string
  source?: string
  tags?: string[]
}): Knowledge {
  const db = getDb()

  const slug = data.slug || generateSlug(data.title)

  const result = db.prepare(`
    INSERT INTO knowledge (category, slug, title, content, story_id, source)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.category,
    slug,
    data.title,
    data.content || null,
    data.story_id || null,
    data.source || null
  )

  const id = result.lastInsertRowid as number

  if (data.tags?.length) {
    tags.setForKnowledge(id, data.tags)
  }

  return get(id)!
}

// Update knowledge
export function update(id: number, data: {
  title?: string
  slug?: string
  content?: string
  tags?: string[]
}): Knowledge | null {
  const db = getDb()

  const existing = get(id)
  if (!existing) return null

  const updates: string[] = []
  const params: any[] = []

  if (data.title !== undefined) {
    updates.push('title = ?')
    params.push(data.title)
  }
  if (data.slug !== undefined) {
    updates.push('slug = ?')
    params.push(data.slug)
  }
  if (data.content !== undefined) {
    updates.push('content = ?')
    params.push(data.content)
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')")
    params.push(id)
    db.prepare(`UPDATE knowledge SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  }

  if (data.tags !== undefined) {
    tags.setForKnowledge(id, data.tags)
  }

  return get(id)
}

// Delete knowledge
export function remove(id: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM knowledge WHERE id = ?').run(id)
  return result.changes > 0
}

// Search knowledge by content
export function search(query: string, category?: KnowledgeCategory): Knowledge[] {
  const db = getDb()

  let sql = "SELECT * FROM knowledge WHERE (title LIKE ? OR content LIKE ?)"
  const params: any[] = [`%${query}%`, `%${query}%`]

  if (category) {
    sql += ' AND category = ?'
    params.push(category)
  }

  sql += ' ORDER BY created_at DESC'

  const rows = db.prepare(sql).all(...params) as KnowledgeRow[]

  return rows.map(row => ({
    ...row,
    tags: tags.getForKnowledge(row.id).map(t => t.name)
  }))
}

// Find by tag
export function findByTag(tagName: string, category?: KnowledgeCategory): Knowledge[] {
  const ids = tags.findKnowledgeByTag(tagName)
  if (ids.length === 0) return []

  const all = ids.map(id => get(id)).filter((k): k is Knowledge => k !== null)

  if (category) {
    return all.filter(k => k.category === category)
  }

  return all
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}
