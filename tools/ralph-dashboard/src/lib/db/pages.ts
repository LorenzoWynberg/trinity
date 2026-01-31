import { getDb } from './index'
import * as tagsDb from './tags'
import * as chaptersDb from './chapters'
import type { Book } from './chapters'

export type Page = {
  id: number
  chapter_id: number
  slug: string
  title: string
  content: string | null
  sort_order: number
  story_id: string | null
  source: string | null
  created_at: string
  updated_at: string
  tags?: string[]
}

type PageRow = Omit<Page, 'tags'>

function withTags(row: PageRow): Page {
  return {
    ...row,
    tags: getTagsForPage(row.id)
  }
}

function getTagsForPage(pageId: number): string[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT t.name FROM tags t
    JOIN page_tags pt ON pt.tag_id = t.id
    WHERE pt.page_id = ?
    ORDER BY t.name
  `).all(pageId) as { name: string }[]
  return rows.map(r => r.name)
}

// List pages for a chapter
export function listByChapter(chapterId: number): Page[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM pages WHERE chapter_id = ? ORDER BY sort_order, title'
  ).all(chapterId) as PageRow[]
  return rows.map(withTags)
}

// List pages for a book (across all chapters)
export function listByBook(book: Book): Page[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT p.* FROM pages p
    JOIN chapters c ON c.id = p.chapter_id
    WHERE c.book = ?
    ORDER BY c.sort_order, c.title, p.sort_order, p.title
  `).all(book) as PageRow[]
  return rows.map(withTags)
}

// Get page by ID
export function get(id: number): Page | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as PageRow | undefined
  return row ? withTags(row) : null
}

// Get page by chapter and slug
export function getBySlug(chapterId: number, slug: string): Page | null {
  const db = getDb()
  const row = db.prepare(
    'SELECT * FROM pages WHERE chapter_id = ? AND slug = ?'
  ).get(chapterId, slug) as PageRow | undefined
  return row ? withTags(row) : null
}

// Get pages linked to a story
export function getByStory(storyId: string): Page[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM pages WHERE story_id = ? ORDER BY created_at DESC'
  ).all(storyId) as PageRow[]
  return rows.map(withTags)
}

// Create a page
export function create(data: {
  chapter_id: number
  slug: string
  title: string
  content?: string
  sort_order?: number
  story_id?: string
  source?: string
  tags?: string[]
}): Page {
  const db = getDb()

  const result = db.prepare(`
    INSERT INTO pages (chapter_id, slug, title, content, sort_order, story_id, source)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.chapter_id,
    data.slug,
    data.title,
    data.content || null,
    data.sort_order || 0,
    data.story_id || null,
    data.source || null
  )

  const id = result.lastInsertRowid as number

  if (data.tags?.length) {
    setTags(id, data.tags)
  }

  return get(id)!
}

// Update a page
export function update(id: number, data: {
  title?: string
  slug?: string
  content?: string
  sort_order?: number
  tags?: string[]
}): Page | null {
  const db = getDb()

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
  if (data.sort_order !== undefined) {
    updates.push('sort_order = ?')
    params.push(data.sort_order)
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')")
    params.push(id)
    db.prepare(`UPDATE pages SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  }

  if (data.tags !== undefined) {
    setTags(id, data.tags)
  }

  return get(id)
}

// Delete a page
export function remove(id: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM pages WHERE id = ?').run(id)
  return result.changes > 0
}

// Set tags for a page
export function setTags(pageId: number, tagNames: string[]): void {
  const db = getDb()

  db.prepare('DELETE FROM page_tags WHERE page_id = ?').run(pageId)

  for (const name of tagNames) {
    const tag = tagsDb.getOrCreate(name)
    db.prepare('INSERT OR IGNORE INTO page_tags (page_id, tag_id) VALUES (?, ?)').run(pageId, tag.id)
  }
}

// Search pages by content
export function search(query: string, book?: Book): Page[] {
  const db = getDb()

  let sql = `
    SELECT p.* FROM pages p
    JOIN chapters c ON c.id = p.chapter_id
    WHERE (p.title LIKE ? OR p.content LIKE ?)
  `
  const params: any[] = [`%${query}%`, `%${query}%`]

  if (book) {
    sql += ' AND c.book = ?'
    params.push(book)
  }

  sql += ' ORDER BY p.created_at DESC'

  const rows = db.prepare(sql).all(...params) as PageRow[]
  return rows.map(withTags)
}

// Find pages by tag
export function findByTag(tagName: string, book?: Book): Page[] {
  const db = getDb()

  let sql = `
    SELECT DISTINCT p.* FROM pages p
    JOIN page_tags pt ON pt.page_id = p.id
    JOIN tags t ON t.id = pt.tag_id
    JOIN chapters c ON c.id = p.chapter_id
    WHERE t.name = ?
  `
  const params: any[] = [tagName]

  if (book) {
    sql += ' AND c.book = ?'
    params.push(book)
  }

  sql += ' ORDER BY p.created_at DESC'

  const rows = db.prepare(sql).all(...params) as PageRow[]
  return rows.map(withTags)
}

// Convenience: create page in a book/chapter (creates chapter if needed)
export function createInBook(book: Book, chapterSlug: string, data: {
  slug: string
  title: string
  content?: string
  chapterTitle?: string
  story_id?: string
  source?: string
  tags?: string[]
}): Page {
  const chapter = chaptersDb.getOrCreate(book, chapterSlug, data.chapterTitle || chapterSlug)
  return create({
    chapter_id: chapter.id,
    slug: data.slug,
    title: data.title,
    content: data.content,
    story_id: data.story_id,
    source: data.source,
    tags: data.tags
  })
}
