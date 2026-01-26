'use client'

import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { Button } from '@/components/ui/button'
import { Play, Square, BarChart2, Info } from 'lucide-react'

export function TerminalView() {
  const termRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!termRef.current) return

    // Create terminal with cyber theme
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: '#1a1025',
        foreground: '#f0abfc',
        cursor: '#22d3ee',
        cursorAccent: '#1a1025',
        selectionBackground: '#f472b680',
        black: '#1a1025',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#f472b6',
        cyan: '#22d3ee',
        white: '#f0abfc',
        brightBlack: '#6b7280',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#f9a8d4',
        brightCyan: '#67e8f9',
        brightWhite: '#fdf4ff',
      }
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(termRef.current)
    fitAddon.fit()
    terminalRef.current = term
    fitAddonRef.current = fitAddon

    // Connect WebSocket
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      // Send initial size
      ws.send(JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows
      }))
    }

    ws.onmessage = (e) => term.write(e.data)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    // Send keystrokes to server
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: term.cols,
          rows: term.rows
        }))
      }
    })
    resizeObserver.observe(termRef.current)

    return () => {
      resizeObserver.disconnect()
      ws.close()
      term.dispose()
    }
  }, [])

  const sendInput = (input: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: input }))
    }
  }

  const runRalph = (args = '') => {
    sendInput(`./ralph.elv ${args}\r`)
  }

  const sendCtrlC = () => {
    sendInput('\x03')
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Quick commands */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={() => runRalph()}>
          <Play className="h-4 w-4 mr-1" /> Run
        </Button>
        <Button size="sm" variant="outline" onClick={sendCtrlC}>
          <Square className="h-4 w-4 mr-1" /> Stop
        </Button>
        <Button size="sm" variant="outline" onClick={() => runRalph('--status')}>
          <Info className="h-4 w-4 mr-1" /> Status
        </Button>
        <Button size="sm" variant="outline" onClick={() => runRalph('--stats')}>
          <BarChart2 className="h-4 w-4 mr-1" /> Stats
        </Button>
        <div className="flex-1" />
        <span className={`text-xs self-center px-2 py-1 rounded ${connected ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10'}`}>
          {connected ? '● Connected' : '○ Disconnected'}
        </span>
      </div>

      {/* Terminal */}
      <div
        ref={termRef}
        className="rounded-lg border overflow-hidden bg-[#1a1025] p-2"
        style={{ height: 500 }}
      />
    </div>
  )
}
