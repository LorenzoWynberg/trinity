const { WebSocketServer } = require('ws')
const pty = require('node-pty')
const path = require('path')

const PORT = process.env.WS_PORT || 4001
const wss = new WebSocketServer({ port: PORT })

const cliDir = path.join(__dirname, '..', 'cli')
const shell = '/bin/zsh'  // Use explicit path

wss.on('connection', (ws) => {
  console.log(`[${new Date().toISOString()}] Client connected`)

  // Spawn a real PTY shell
  const ptyProcess = pty.spawn(shell, [], {
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

  // Send welcome message then shell prompt will appear
  ws.send('\x1b[36mRalph Terminal\x1b[0m - Full PTY shell\r\n')
  ws.send('\x1b[90mWorking directory: ' + cliDir + '\x1b[0m\r\n\r\n')

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
    console.log(`[${new Date().toISOString()}] Client disconnected`)
    ptyProcess.kill()
  })

  ptyProcess.onExit(({ exitCode }) => {
    console.log(`[${new Date().toISOString()}] Shell exited with code ${exitCode}`)
    ws.close()
  })
})

console.log(`Terminal WebSocket server running on ws://localhost:${PORT}`)
console.log(`Working directory: ${cliDir}`)
console.log(`Shell: ${shell}`)
console.log(`\nThis is a full PTY - interactive programs like 'claude' should work`)
