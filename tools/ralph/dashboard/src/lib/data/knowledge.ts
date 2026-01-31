import fs from 'fs/promises'
import path from 'path'
import type { KnowledgeChapter, ChapterIndex, KnowledgePage } from '../types'

const PROJECT_ROOT = path.join(process.cwd(), '../../..')
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs')

export async function getKnowledge(): Promise<{ category: string; content: string }[]> {
  try {
    const knowledgeDir = path.join(DOCS_DIR, 'knowledge')
    const files = await fs.readdir(knowledgeDir)
    const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md')

    const knowledge = await Promise.all(
      mdFiles.map(async (file) => {
        const content = await fs.readFile(path.join(knowledgeDir, file), 'utf-8')
        return {
          category: file.replace('.md', ''),
          content
        }
      })
    )

    return knowledge
  } catch {
    return []
  }
}

export async function getGotchas(): Promise<{ category: string; content: string }[]> {
  try {
    const gotchasDir = path.join(DOCS_DIR, 'gotchas')
    const files = await fs.readdir(gotchasDir)
    const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md')

    const gotchas = await Promise.all(
      mdFiles.map(async (file) => {
        const content = await fs.readFile(path.join(gotchasDir, file), 'utf-8')
        return {
          category: file.replace('.md', ''),
          content
        }
      })
    )

    return gotchas
  } catch {
    return []
  }
}

async function getChaptersFromDir(dirPath: string): Promise<KnowledgeChapter[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    const chapters: KnowledgeChapter[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue  // Skip loose files

      const chapterDir = path.join(dirPath, entry.name)
      const indexPath = path.join(chapterDir, 'index.json')

      try {
        // Read index.json for metadata
        const indexContent = await fs.readFile(indexPath, 'utf-8')
        const index: ChapterIndex = JSON.parse(indexContent)

        // Read pages based on order in index.json
        const pages: KnowledgePage[] = []
        for (const pageMeta of index.pages) {
          const mdPath = path.join(chapterDir, `${pageMeta.slug}.md`)
          try {
            const content = await fs.readFile(mdPath, 'utf-8')
            pages.push({
              slug: pageMeta.slug,
              title: pageMeta.title,
              content
            })
          } catch {
            // Page file doesn't exist, skip
          }
        }

        chapters.push({
          slug: entry.name,
          index,
          pages
        })
      } catch {
        // No index.json or invalid, skip this directory
      }
    }

    // Sort chapters alphabetically by title
    return chapters.sort((a, b) => a.index.title.localeCompare(b.index.title))
  } catch {
    return []
  }
}

export async function getKnowledgeChapters(): Promise<KnowledgeChapter[]> {
  return getChaptersFromDir(path.join(DOCS_DIR, 'knowledge'))
}

export async function getGotchasChapters(): Promise<KnowledgeChapter[]> {
  return getChaptersFromDir(path.join(DOCS_DIR, 'gotchas'))
}
