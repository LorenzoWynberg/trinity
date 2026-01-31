// Knowledge and Gotchas data layer - reads from SQLite
// Falls back to importing from markdown if DB is empty

import * as knowledgeDb from '@/lib/db/knowledge'
import * as gotchasDb from '@/lib/db/gotchas'
import * as chaptersDb from '@/lib/db/chapters'
import * as pagesDb from '@/lib/db/pages'
import { importAllDocs } from '@/lib/db/import-docs'
import type { KnowledgeChapter, ChapterIndex, KnowledgePage } from '../types'

// Ensure docs are imported on first access
let docsImported = false

function ensureDocsImported() {
  if (docsImported) return

  // Check if we have any chapters
  const knowledgeChapters = knowledgeDb.listChapters()
  const gotchasChapters = gotchasDb.listChapters()

  if (knowledgeChapters.length === 0 && gotchasChapters.length === 0) {
    // Import from markdown files
    console.log('[knowledge] Importing docs from markdown files...')
    const result = importAllDocs()
    console.log(`[knowledge] Imported ${result.knowledge.chapters} knowledge chapters, ${result.knowledge.pages} pages`)
    console.log(`[knowledge] Imported ${result.gotchas.chapters} gotchas chapters, ${result.gotchas.pages} pages`)
  }

  docsImported = true
}

// Convert DB chapter/pages to the KnowledgeChapter format used by UI
function toKnowledgeChapter(chapter: chaptersDb.Chapter): KnowledgeChapter {
  const dbPages = pagesDb.listByChapter(chapter.id)

  const index: ChapterIndex = {
    title: chapter.title,
    description: chapter.description || undefined,
    icon: chapter.icon || undefined,
    pages: dbPages.map(p => ({ slug: p.slug, title: p.title }))
  }

  const pages: KnowledgePage[] = dbPages.map(p => ({
    slug: p.slug,
    title: p.title,
    content: p.content || ''
  }))

  return {
    slug: chapter.slug,
    index,
    pages
  }
}

export async function getKnowledgeChapters(): Promise<KnowledgeChapter[]> {
  ensureDocsImported()
  const chapters = knowledgeDb.listChapters()
  return chapters.map(toKnowledgeChapter)
}

export async function getGotchasChapters(): Promise<KnowledgeChapter[]> {
  ensureDocsImported()
  const chapters = gotchasDb.listChapters()
  return chapters.map(toKnowledgeChapter)
}

// Legacy functions for backwards compatibility
export async function getKnowledge(): Promise<{ category: string; content: string }[]> {
  ensureDocsImported()
  const pages = pagesDb.listByBook('knowledge')
  return pages.map(p => ({
    category: p.slug,
    content: p.content || ''
  }))
}

export async function getGotchas(): Promise<{ category: string; content: string }[]> {
  ensureDocsImported()
  const pages = pagesDb.listByBook('gotchas')
  return pages.map(p => ({
    category: p.slug,
    content: p.content || ''
  }))
}
