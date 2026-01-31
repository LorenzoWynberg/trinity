// Gotchas convenience wrapper
// Gotchas are pages in the 'gotchas' book

import * as chapters from './chapters'
import * as pages from './pages'

export type { Chapter } from './chapters'
export type { Page } from './pages'

// List all gotcha chapters
export function listChapters() {
  return chapters.list('gotchas')
}

// Get a chapter
export function getChapter(slug: string) {
  return chapters.get('gotchas', slug)
}

// Create a chapter
export function createChapter(data: {
  slug: string
  title: string
  description?: string
  icon?: string
}) {
  return chapters.create({ ...data, book: 'gotchas' })
}

// List all gotcha pages
export function listPages() {
  return pages.listByBook('gotchas')
}

// List pages in a chapter
export function listPagesInChapter(chapterId: number) {
  return pages.listByChapter(chapterId)
}

// Get a page
export function getPage(id: number) {
  return pages.get(id)
}

// Create a gotcha page
export function createPage(chapterSlug: string, data: {
  slug: string
  title: string
  content?: string
  chapterTitle?: string
  story_id?: string
  source?: string
  tags?: string[]
}) {
  return pages.createInBook('gotchas', chapterSlug, data)
}

// Update a page
export function updatePage(id: number, data: Parameters<typeof pages.update>[1]) {
  return pages.update(id, data)
}

// Delete a page
export function deletePage(id: number) {
  return pages.remove(id)
}

// Search gotchas
export function search(query: string) {
  return pages.search(query, 'gotchas')
}

// Find by tag
export function findByTag(tagName: string) {
  return pages.findByTag(tagName, 'gotchas')
}

// Get gotchas linked to a story
export function getByStory(storyId: string) {
  return pages.getByStory(storyId).filter(p => {
    const chapter = chapters.getById(p.chapter_id)
    return chapter?.book === 'gotchas'
  })
}
