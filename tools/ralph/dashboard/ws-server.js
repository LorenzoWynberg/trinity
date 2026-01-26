const { WebSocketServer } = require('ws')
const pty = require('node-pty')
const path = require('path')

const PORT = process.env.WS_PORT || 4001
const SESSION_NAME = process.env.TMUX_SESSION || 'ralph'
const wss = new WebSocketServer({ port: PORT })

const cliDir = path.join(__dirname, '..', 'cli')

wss.on('connection', (ws) => {
  console.log(`[${new Date().toISOString()}] Client connected`)

  // Spawn tmux - creates new session or attaches to existing one
  // -A: attach to session if it exists, create if not
  // -s: session name
  const ptyProcess = pty.spawn('tmux', ['new-session', '-A', '-s', SESSION_NAME], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: cliDir,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    }
  })

  // PTY output -> WebSocket
  ptyProcess.onData((data) => {
    ws.send(data)
  })

  // WebSocket input -> PTY
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString())
      if (data.type === 'input') {
        ptyProcess.write(data.data)
      } else if (data.type === 'resize') {
        ptyProcess.resize(data.cols || 120, data.rows || 30)
      }
    } catch (e) {
      // If not JSON, treat as raw input
      ptyProcess.write(msg.toString())
    }
  })

  ws.on('close', () => {
    console.log(`[${new Date().toISOString()}] Client disconnected (tmux session "${SESSION_NAME}" persists)`)
    // Kill the PTY process (detaches from tmux) but tmux session survives
    ptyProcess.kill()
  })

  ptyProcess.onExit(({ exitCode }) => {
    console.log(`[${new Date().toISOString()}] PTY exited with code ${exitCode}`)
    ws.close()
  })
})

console.log(`Terminal WebSocket server running on ws://localhost:${PORT}`)
console.log(`Working directory: ${cliDir}`)
console.log(`tmux session: ${SESSION_NAME}`)
console.log(`\nSessions persist across page refresh/reconnect`)
