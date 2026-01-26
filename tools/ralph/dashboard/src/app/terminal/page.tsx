import { TerminalView } from '@/components/terminal-view'
import { CommandReference } from '@/components/command-reference'

export default function TerminalPage() {
  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold cyber-light:text-pink-600 cyber-dark:text-cyan-400">Terminal</h1>
          <p className="text-sm text-muted-foreground cyber-light:text-cyan-600">
            Run Ralph interactively
          </p>
        </div>
        <CommandReference />
      </div>
      <TerminalView />
    </div>
  )
}
