import { TerminalView } from '@/components/terminal-view'
import { CommandReference } from '@/components/command-reference'

export default function TerminalPage() {
  return (
    <div className="h-[calc(100vh-4rem)] md:h-auto flex flex-col p-4 md:p-8 overflow-hidden md:overflow-visible">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold">Terminal</h1>
          <p className="text-sm text-muted-foreground">
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
