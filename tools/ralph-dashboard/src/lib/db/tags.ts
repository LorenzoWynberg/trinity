import { getDb } from './index'

export type Tag = {
  id: number
  name: string
  created_at: string
}

// Get all tags
export function list(): Tag[] {
  const db = getDb()
  return db.prepare('SELECT * FROM tags ORDER BY name').all() as Tag[]
}

// Get or create a tag by name
export function getOrCreate(name: string): Tag {
  const db = getDb()

  let tag = db.prepare('SELECT * FROM tags WHERE name = ?').get(name) as Tag | undefined

  if (!tag) {
    const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name)
    tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid) as Tag
  }

  return tag
}

// Get tags for a story
export function getForStory(storyId: string): Tag[] {
  const db = getDb()
  return db.prepare(`
    SELECT t.* FROM tags t
    JOIN story_tags st ON st.tag_id = t.id
    WHERE st.story_id = ?
    ORDER BY t.name
  `).all(storyId) as Tag[]
}

// Set tags for a story (replaces existing)
export function setForStory(storyId: string, tagNames: string[]): void {
  const db = getDb()

  // Remove existing tags
  db.prepare('DELETE FROM story_tags WHERE story_id = ?').run(storyId)

  // Add new tags
  for (const name of tagNames) {
    const tag = getOrCreate(name)
    db.prepare('INSERT OR IGNORE INTO story_tags (story_id, tag_id) VALUES (?, ?)').run(storyId, tag.id)
  }
}

// Add a tag to a story
export function addToStory(storyId: string, tagName: string): void {
  const db = getDb()
  const tag = getOrCreate(tagName)
  db.prepare('INSERT OR IGNORE INTO story_tags (story_id, tag_id) VALUES (?, ?)').run(storyId, tag.id)
}

// Remove a tag from a story
export function removeFromStory(storyId: string, tagName: string): void {
  const db = getDb()
  db.prepare(`
    DELETE FROM story_tags
    WHERE story_id = ? AND tag_id = (SELECT id FROM tags WHERE name = ?)
  `).run(storyId, tagName)
}

// Get tags for a page
export function getForPage(pageId: number): Tag[] {
  const db = getDb()
  return db.prepare(`
    SELECT t.* FROM tags t
    JOIN page_tags pt ON pt.tag_id = t.id
    WHERE pt.page_id = ?
    ORDER BY t.name
  `).all(pageId) as Tag[]
}

// Set tags for a page (replaces existing)
export function setForPage(pageId: number, tagNames: string[]): void {
  const db = getDb()

  db.prepare('DELETE FROM page_tags WHERE page_id = ?').run(pageId)

  for (const name of tagNames) {
    const tag = getOrCreate(name)
    db.prepare('INSERT OR IGNORE INTO page_tags (page_id, tag_id) VALUES (?, ?)').run(pageId, tag.id)
  }
}

// Find stories by tag
export function findStoriesByTag(tagName: string): string[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT st.story_id FROM story_tags st
    JOIN tags t ON t.id = st.tag_id
    WHERE t.name = ?
  `).all(tagName) as { story_id: string }[]
  return rows.map(r => r.story_id)
}

// Find pages by tag
export function findPagesByTag(tagName: string): number[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT pt.page_id FROM page_tags pt
    JOIN tags t ON t.id = pt.tag_id
    WHERE t.name = ?
  `).all(tagName) as { page_id: number }[]
  return rows.map(r => r.page_id)
}
