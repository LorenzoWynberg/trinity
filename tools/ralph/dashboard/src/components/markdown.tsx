'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface MarkdownProps {
  content: string
  className?: string
}

export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={cn(
      'prose prose-sm dark:prose-invert max-w-none',
      // Override all prose code/pre styles to prevent conflicts
      'prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0 prose-pre:border-0',
      'prose-code:bg-transparent prose-code:p-0 prose-code:font-normal',
      'prose-code:before:content-none prose-code:after:content-none',
      className
    )}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Style headings
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-6 mb-4 pb-2 border-b border-border">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold mt-5 mb-3">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mt-3 mb-2">{children}</h4>
          ),
          // Style paragraphs
          p: ({ children }) => (
            <p className="mb-3 leading-relaxed">{children}</p>
          ),
          // Style lists
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-6 mb-3 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-6 mb-3 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          // Style code - detect code blocks by checking for language- class
          code: ({ children, className, ...props }) => {
            // Code blocks have language-* class OR are direct children of pre (no inline context)
            const isCodeBlock = className?.startsWith('language-') ||
              (props.node?.position?.start?.line === props.node?.position?.end?.line === false)

            if (isCodeBlock || className) {
              // Code block - minimal styling, pre handles the container
              return <code className="text-sm" {...props}>{children}</code>
            }
            // Inline code
            return (
              <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            )
          },
          // Style pre blocks (code blocks) - clean look, no border
          pre: ({ children }) => (
            <div className="not-prose mb-4">
              <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto text-sm font-mono !border-none !outline-none" style={{ border: 'none' }}>
                {children}
              </pre>
            </div>
          ),
          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/50 pl-4 italic text-muted-foreground mb-4">
              {children}
            </blockquote>
          ),
          // Style tables
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border-collapse border border-border">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border border-border px-3 py-2 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-2">{children}</td>
          ),
          // Style links
          a: ({ href, children }) => (
            <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          // Style horizontal rules
          hr: () => <hr className="my-6 border-border" />,
          // Style strong/bold
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          // Style emphasis/italic
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
