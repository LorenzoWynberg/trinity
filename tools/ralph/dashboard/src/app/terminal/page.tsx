import { TerminalView } from '@/components/terminal-view'
import { CommandReference } from '@/components/command-reference'

export default function TerminalPage() {
  return (
    <div className="h-[calc(100dvh-4rem-env(safe-area-inset-bottom))] md:h-[calc(100vh-2rem)] flex flex-col p-3 md:p-6">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Terminal</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Run Ralph interactively
          </p>
        </div>
        <CommandReference />
      </div>
      <div className="flex-1 min-h-0">
        <TerminalView />
      </div>
    </div>
  )
}
