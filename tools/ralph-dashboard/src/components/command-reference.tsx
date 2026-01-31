'use client'

import { useState } from 'react'
import { Info, Copy, Check } from 'lucide-react'
import { useMounted } from '@/hooks/use-mounted'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface CommandItem {
  command: string
  description: string
}

interface CommandSection {
  title: string
  items: CommandItem[]
}

const commandSections: CommandSection[] = [
  {
    title: 'Auto Flags',
    items: [
      { command: '--auto-pr', description: 'Auto-create PR without prompting' },
      { command: '--auto-merge', description: 'Auto-merge PR without prompting' },
      { command: '--auto-clarify', description: 'Auto-proceed on validation questions' },
      { command: '--auto-handle-duplicates', description: 'Auto-update existing story when duplicate detected' },
      { command: '--auto-add-reverse-deps', description: 'Auto-add reverse dependencies when suggested' },
      { command: '--auto-update-related', description: 'Auto-apply related story updates (tag-based)' },
      { command: '--yolo', description: 'Enable ALL auto flags at once' },
    ],
  },
  {
    title: 'Control Flags',
    items: [
      { command: '--max-iterations <n>', description: 'Max iterations before auto-stop (default: 100)' },
      { command: '--base-branch <name>', description: 'Base branch for story branches (default: dev)' },
      { command: '--timeout <seconds>', description: 'Claude timeout (default: 1800)' },
      { command: '--target-version <ver>', description: 'Only work on stories for specific version' },
    ],
  },
  {
    title: 'Mode Flags',
    items: [
      { command: '--resume', description: 'Resume from last state' },
      { command: '--reset', description: 'Reset state and start fresh' },
      { command: '--status', description: 'Show PRD status and exit' },
      { command: '--stats', description: 'Show metrics and exit' },
      { command: '--version-status', description: 'Show version progress and exit' },
      { command: '--plan', description: 'Plan mode (read-only, no changes)' },
      { command: '-q, --quiet', description: 'Hide Claude output' },
      { command: '-v, --verbose', description: 'Show full prompts/responses' },
    ],
  },
  {
    title: 'Action Flags',
    items: [
      { command: '--skip ID "reason"', description: 'Skip a story' },
      { command: '--retry-clean ID', description: 'Reset story for retry' },
    ],
  },
  {
    title: 'Release Flags',
    items: [
      { command: '--skip-release', description: 'Skip release workflow' },
      { command: '--auto-release', description: 'Auto-release without human gate' },
      { command: '--release-tag <tag>', description: 'Custom release tag name' },
    ],
  },
  {
    title: 'Other',
    items: [
      { command: '--no-notifs', description: 'Disable notifications (default: on)' },
      { command: '-h, --help', description: 'Show help' },
    ],
  },
]

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState<'flag' | 'full' | null>(null)
  const [showOptions, setShowOptions] = useState(false)

  const flagOnly = command.split(' ')[0]
  const fullCommand = `./ralph.elv ${command}`

  const handleCopy = async (type: 'flag' | 'full') => {
    const textToCopy = type === 'flag' ? flagOnly : fullCommand
    await navigator.clipboard.writeText(textToCopy)
    setCopied(type)
    setShowOptions(false)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowOptions(!showOptions)}
        className={cn(
          'group flex items-center gap-1.5 font-mono text-sm px-2 py-1 rounded',
          'bg-muted/50 hover:bg-muted transition-colors cursor-pointer',
          'text-cyan-600 dark:text-cyan-400 cyber-light:text-cyan-600 cyber-dark:text-foreground'
        )}
        title="Click to copy"
      >
        <code>{command}</code>
        {copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
        )}
      </button>

      {showOptions && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowOptions(false)}
          />
          <div className="absolute left-0 top-full mt-1 z-50 bg-popover border rounded-md shadow-lg overflow-hidden min-w-[160px]">
            <button
              onClick={() => handleCopy('full')}
              className="w-full px-3 py-2 text-left text-xs hover:bg-muted transition-colors flex items-center gap-2"
            >
              <Copy className="h-3 w-3" />
              <span>Copy full command</span>
            </button>
            <button
              onClick={() => handleCopy('flag')}
              className="w-full px-3 py-2 text-left text-xs hover:bg-muted transition-colors flex items-center gap-2 border-t"
            >
              <Copy className="h-3 w-3" />
              <span>Copy flag only</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function CommandReference() {
  const mounted = useMounted()

  if (!mounted) {
    return (
      <Button size="sm" variant="outline" disabled>
        <Info className="h-4 w-4 mr-1" />
        Commands
      </Button>
    )
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Info className="h-4 w-4 mr-1" />
          Commands
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ralph Command Reference</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* Basic usage */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Usage</h3>
            <div className="bg-muted/30 rounded-lg p-3 font-mono text-sm">
              ./ralph.elv [OPTIONS]
            </div>
          </div>

          {/* Command sections */}
          {commandSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <div
                    key={item.command}
                    className="flex items-start gap-3 py-1.5"
                  >
                    <CopyableCommand command={item.command} />
                    <span className="text-sm text-muted-foreground pt-1">
                      {item.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Prompts reference */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Interactive Prompts
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="font-mono text-yellow-600 dark:text-yellow-400">[y/n]</span>
                <span className="text-muted-foreground">Yes / No</span>
              </div>
              <div className="flex gap-2">
                <span className="font-mono text-yellow-600 dark:text-yellow-400">[f]</span>
                <span className="text-muted-foreground">Provide feedback (opens editor)</span>
              </div>
              <div className="flex gap-2">
                <span className="font-mono text-yellow-600 dark:text-yellow-400">[c]</span>
                <span className="text-muted-foreground">Clarify (opens editor for answers)</span>
              </div>
              <div className="flex gap-2">
                <span className="font-mono text-yellow-600 dark:text-yellow-400">[a]</span>
                <span className="text-muted-foreground">Auto-proceed with assumptions</span>
              </div>
              <div className="flex gap-2">
                <span className="font-mono text-yellow-600 dark:text-yellow-400">[r]</span>
                <span className="text-muted-foreground">Report (for external deps)</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
          Click any command to copy to clipboard
        </p>
      </DialogContent>
    </Dialog>
  )
}
