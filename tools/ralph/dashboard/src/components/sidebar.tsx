'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ListTodo,
  BarChart3,
  Clock,
  BookOpen,
  Settings,
  GitBranch,
  TerminalSquare,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/stories', label: 'Stories', icon: ListTodo },
  { href: '/graph', label: 'Graph', icon: GitBranch },
  { href: '/terminal', label: 'Terminal', icon: TerminalSquare },
  { href: '/metrics', label: 'Metrics', icon: BarChart3 },
  { href: '/activity', label: 'Activity', icon: Clock },
  { href: '/learnings', label: 'Learnings', icon: BookOpen },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Wait for mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const sidebarContent = (
    <>
      <div className="p-6 border-b flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold cyber-light:text-pink-600 cyber-dark:text-cyan-400">Ralph Dashboard</h1>
          <p className="text-sm text-muted-foreground cyber-light:text-cyan-600">PRD Viewer</p>
        </div>
        {/* Close button - mobile only */}
        <button
          onClick={() => setIsOpen(false)}
          className="lg:hidden p-2 -mr-2 hover:bg-muted rounded-md"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground cyber-light:hover:text-pink-600 cyber-dark:hover:text-cyan-400'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground cyber-light:hover:text-pink-600 cyber-dark:hover:text-cyan-400 transition-colors"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger button - only render after mount */}
      {mounted && (
        <button
          onClick={() => setIsOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-background border rounded-md shadow-lg"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Mobile overlay */}
      {mounted && isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer - only render after mount */}
      {mounted && (
        <aside
          className={cn(
            'lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-background border-r flex flex-col transform transition-transform duration-200 ease-in-out',
            isOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {sidebarContent}
        </aside>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 border-r bg-muted/30 flex-col">
        {sidebarContent}
      </aside>
    </>
  )
}
