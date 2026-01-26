import { TerminalView } from '@/components/terminal-view'
import { CommandReference } from '@/components/command-reference'

export default function TerminalPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Terminal</h1>
          <p className="text-sm text-muted-foreground">
            Run Ralph interactively
          </p>
        </div>
        <CommandReference />
      </div>
      <TerminalView />
    </div>
  )
}
