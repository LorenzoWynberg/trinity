/**
 * Import markdown docs from docs/knowledge and docs/gotchas into SQLite
 */

import fs from 'fs'
import path from 'path'
import * as chapters from './chapters'
import * as pages from './pages'
import type { Book } from './chapters'

const PROJECT_ROOT = path.join(process.cwd(), '../../..')
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs')

type ChapterIndex = {
  title: string
  description?: string
  icon?: string
  pages: { slug: string; title: string }[]
}

function importBook(book: Book): { chapters: number; pages: number } {
  const bookDir = path.join(DOCS_DIR, book === 'knowledge' ? 'knowledge' : 'gotchas')

  if (!fs.existsSync(bookDir)) {
    return { chapters: 0, pages: 0 }
  }

  let chapterCount = 0
  let pageCount = 0

  const entries = fs.readdirSync(bookDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const chapterDir = path.join(bookDir, entry.name)
    const indexPath = path.join(chapterDir, 'index.json')

    if (!fs.existsSync(indexPath)) continue

    try {
      const indexContent = fs.readFileSync(indexPath, 'utf-8')
      const index: ChapterIndex = JSON.parse(indexContent)

      // Create or get chapter
      const chapter = chapters.getOrCreate(book, entry.name, index.title)

      // Update chapter metadata
      chapters.update(chapter.id, {
        description: index.description,
        icon: index.icon
      })

      chapterCount++

      // Import pages
      for (let i = 0; i < index.pages.length; i++) {
        const pageMeta = index.pages[i]
        const mdPath = path.join(chapterDir, `${pageMeta.slug}.md`)

        if (!fs.existsSync(mdPath)) continue

        const content = fs.readFileSync(mdPath, 'utf-8')

        // Check if page exists
        const existingPage = pages.getBySlug(chapter.id, pageMeta.slug)

        if (existingPage) {
          // Update existing page
          pages.update(existingPage.id, {
            title: pageMeta.title,
            content,
            sort_order: i
          })
        } else {
          // Create new page
          pages.create({
            chapter_id: chapter.id,
            slug: pageMeta.slug,
            title: pageMeta.title,
            content,
            sort_order: i,
            source: 'import'
          })
        }

        pageCount++
      }
    } catch (e) {
      console.error(`Error importing chapter ${entry.name}:`, e)
    }
  }

  return { chapters: chapterCount, pages: pageCount }
}

export function importAllDocs(): { knowledge: { chapters: number; pages: number }; gotchas: { chapters: number; pages: number } } {
  const knowledge = importBook('knowledge')
  const gotchas = importBook('gotchas')

  return { knowledge, gotchas }
}

export function importKnowledge() {
  return importBook('knowledge')
}

export function importGotchas() {
  return importBook('gotchas')
}
