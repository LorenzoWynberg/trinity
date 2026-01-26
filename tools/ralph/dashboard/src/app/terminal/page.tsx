import { TerminalView } from '@/components/terminal-view'
import { CommandReference } from '@/components/command-reference'

export default function TerminalPage() {
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
      <div className="h-[20vh] md:h-[75vh]">
        <TerminalView />
      </div>
    </div>
  )
}
