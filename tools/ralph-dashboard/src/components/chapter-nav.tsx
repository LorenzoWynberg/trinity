'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Markdown } from '@/components/markdown'
import type { KnowledgeChapter } from '@/lib/types'
import { BookOpen, Terminal, Layout, Code2, Cpu, FileCode, Lightbulb, AlertTriangle } from 'lucide-react'

const iconMap: Record<string, React.ElementType> = {
  BookOpen,
  Terminal,
  Layout,
  Code2,
  Cpu,
  FileCode,
  Lightbulb,
  AlertTriangle,
}

interface ChapterNavProps {
  chapters: KnowledgeChapter[]
  basePath?: string
}

export function ChapterNav({ chapters, basePath = '/knowledge' }: ChapterNavProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Get current book and chapter from URL, with defaults
  const currentBookSlug = searchParams.get('book') || chapters[0]?.slug || ''
  const currentChapterSlug = searchParams.get('chapter') || 'index'

  // Find current book
  const currentBook = chapters.find(c => c.slug === currentBookSlug) || chapters[0]

  // Find current chapter
  const currentChapter = currentBook?.pages.find(p => p.slug === currentChapterSlug) || currentBook?.pages[0]

  // Get icon component
  const BookIcon = currentBook?.index.icon
    ? iconMap[currentBook.index.icon] || BookOpen
    : BookOpen

  const handleBookChange = (bookSlug: string) => {
    // When changing book, reset to first chapter (index)
    const params = new URLSearchParams(searchParams.toString())
    params.set('book', bookSlug)
    params.delete('chapter') // Reset to default (index)
    router.push(`${basePath}?${params.toString()}`)
  }

  const handleChapterChange = (chapterSlug: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (!params.has('book')) {
      params.set('book', currentBookSlug)
    }
    if (chapterSlug === 'index') {
      params.delete('chapter') // Clean URL for index
    } else {
      params.set('chapter', chapterSlug)
    }
    router.push(`${basePath}?${params.toString()}`)
  }

  if (!currentBook || !currentChapter) {
    return (
      <p className="text-muted-foreground">
        No knowledge docs found in docs/knowledge/
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Book + Chapter Dropdowns */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Book Dropdown */}
        <Select value={currentBookSlug} onValueChange={handleBookChange}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Select book">
              <span className="flex items-center gap-2">
                <BookIcon className="h-4 w-4" />
                {currentBook.index.title}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {chapters.map(book => {
              const Icon = book.index.icon
                ? iconMap[book.index.icon] || BookOpen
                : BookOpen
              return (
                <SelectItem key={book.slug} value={book.slug}>
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {book.index.title}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        {/* Chapter Dropdown (only show if more than one page) */}
        {currentBook.pages.length > 1 && (
          <Select value={currentChapterSlug} onValueChange={handleChapterChange}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select chapter" />
            </SelectTrigger>
            <SelectContent>
              {currentBook.pages.map(chapter => (
                <SelectItem key={chapter.slug} value={chapter.slug}>
                  {chapter.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Content Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookIcon className="h-5 w-5" />
            {currentBook.index.title}
            {currentChapter.title !== 'Overview' && (
              <span className="text-muted-foreground font-normal">/ {currentChapter.title}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Markdown content={currentChapter.content} />
        </CardContent>
      </Card>
    </div>
  )
}
