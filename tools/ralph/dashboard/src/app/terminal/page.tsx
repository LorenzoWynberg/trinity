'use client'

import { useEffect } from 'react'
import { TerminalView } from '@/components/terminal-view'
import { CommandReference } from '@/components/command-reference'

export default function TerminalPage() {
  // Disable scroll on main element for mobile
  useEffect(() => {
    const main = document.querySelector('main')
    if (main && window.innerWidth < 768) {
      main.style.overflow = 'hidden'
      return () => {
        main.style.overflow = ''
      }
    }
  }, [])

  return (
    <div className="p-3 md:p-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Terminal</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Run Ralph interactively
          </p>
        </div>
        <CommandReference />
      </div>
      <div className="h-[50vh] md:h-[75vh]">
        <TerminalView />
      </div>
    </div>
  )
}
