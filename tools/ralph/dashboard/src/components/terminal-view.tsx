'use client'

import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { Button } from '@/components/ui/button'
import { Play, Square, BarChart2, Info, Plus, RotateCcw } from 'lucide-react'

export function TerminalView() {
  const termRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [connected, setConnected] = useState(false)
  const [terminalHeight, setTerminalHeight] = useState(500)
  const defaultHeight = 500

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

    // Determine WebSocket URL
    async function connectWebSocket() {
      let wsUrl = 'ws://localhost:4001'

      // If not on localhost, try to get ngrok tunnel URL
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      if (!isLocalhost) {
        try {
          const res = await fetch('/api/tunnels')
          const tunnels = await res.json()
          if (tunnels.terminal) {
            // Convert https:// to wss://
            wsUrl = tunnels.terminal.replace('https://', 'wss://').replace('http://', 'ws://')
          }
        } catch {
          // Fall back to localhost
        }
      }

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
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
    }

    connectWebSocket()

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'resize',
          cols: term.cols,
          rows: term.rows
        }))
      }
    })
    resizeObserver.observe(termRef.current)

    return () => {
      resizeObserver.disconnect()
      wsRef.current?.close()
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

  const increaseHeight = () => {
    setTerminalHeight(h => h + 100)
    // Refit terminal after height change
    setTimeout(() => {
      fitAddonRef.current?.fit()
      if (wsRef.current?.readyState === WebSocket.OPEN && terminalRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'resize',
          cols: terminalRef.current.cols,
          rows: terminalRef.current.rows
        }))
      }
    }, 50)
  }

  const resetHeight = () => {
    setTerminalHeight(defaultHeight)
    setTimeout(() => {
      fitAddonRef.current?.fit()
      if (wsRef.current?.readyState === WebSocket.OPEN && terminalRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'resize',
          cols: terminalRef.current.cols,
          rows: terminalRef.current.rows
        }))
      }
    }, 50)
  }

  return (
    <div className="space-y-2">
      {/* Quick commands */}
      <div className="flex gap-2 flex-wrap items-center">
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
        <div className="border-l pl-2 ml-1 flex gap-1 items-center">
          <Button size="sm" variant="outline" onClick={increaseHeight} title="Increase height by 100px">
            <Plus className="h-4 w-4 mr-1" /> Height
          </Button>
          {terminalHeight !== defaultHeight && (
            <Button size="sm" variant="ghost" onClick={resetHeight} title="Reset to default height">
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          <span className="text-xs text-muted-foreground">{terminalHeight}px</span>
        </div>
        <span className={`text-xs px-2 py-1 rounded ${connected ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10'}`}>
          {connected ? '● Connected' : '○ Disconnected'}
        </span>
      </div>

      {/* Terminal */}
      <div
        className="rounded-lg border overflow-hidden bg-[#1a1025]"
        style={{ height: `${terminalHeight}px` }}
      >
        <div
          ref={termRef}
          className="h-full w-full"
        />
      </div>
    </div>
  )
}
