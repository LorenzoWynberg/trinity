const { WebSocketServer } = require('ws')
const { spawn } = require('child_process')
const path = require('path')

const PORT = process.env.WS_PORT || 3001
const wss = new WebSocketServer({ port: PORT })

const cliDir = path.join(__dirname, '..', 'cli')

wss.on('connection', (ws) => {
  let currentProcess = null

  console.log(`[${new Date().toISOString()}] Client connected`)

  // Send welcome message
  ws.send('\x1b[36mRalph Terminal\x1b[0m - Type commands or use the buttons above\r\n')
  ws.send('\x1b[90mWorking directory: ' + cliDir + '\x1b[0m\r\n\r\n')
  ws.send('\x1b[32m$\x1b[0m ')

  let inputBuffer = ''

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString())

      if (data.type === 'input') {
        const input = data.data

        // Process each character (handles both single keys and pasted/button text)
        for (const char of input) {
          if (char === '\r' || char === '\n') {
            // Enter pressed - execute command
            ws.send('\r\n')

            const cmd = inputBuffer.trim()
            inputBuffer = ''

            if (cmd) {
              executeCommand(cmd, ws, (proc) => {
                currentProcess = proc
              }, () => {
                currentProcess = null
                ws.send('\r\n\x1b[32m$\x1b[0m ')
              })
            } else {
              ws.send('\x1b[32m$\x1b[0m ')
            }
          } else if (char === '\x7f' || char === '\b') {
            // Backspace
            if (inputBuffer.length > 0) {
              inputBuffer = inputBuffer.slice(0, -1)
              ws.send('\b \b')
            }
          } else if (char === '\x03') {
            // Ctrl+C
            if (currentProcess) {
              currentProcess.kill('SIGINT')
              ws.send('^C\r\n')
            } else {
              inputBuffer = ''
              ws.send('^C\r\n\x1b[32m$\x1b[0m ')
            }
          } else if (char.charCodeAt(0) >= 32) {
            // Regular character
            inputBuffer += char
            ws.send(char)
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse message:', e)
    }
  })

  ws.on('close', () => {
    console.log(`[${new Date().toISOString()}] Client disconnected`)
    if (currentProcess) {
      currentProcess.kill()
    }
  })
})

function executeCommand(cmd, ws, onStart, onEnd) {
  // Parse command
  const parts = cmd.match(/(?:[^\s"]+|"[^"]*")+/g) || []
  if (parts.length === 0) {
    onEnd()
    return
  }

  let command = parts[0]
  let args = parts.slice(1).map(a => a.replace(/^"|"$/g, ''))

  // Handle ./ralph.elv specially - run with elvish
  if (command === './ralph.elv' || command === 'ralph.elv') {
    command = '/opt/homebrew/bin/elvish'
    args = ['./ralph.elv', ...args]
  }

  console.log(`[${new Date().toISOString()}] Executing: ${command} ${args.join(' ')}`)

  const proc = spawn(command, args, {
    cwd: cliDir,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      PATH: `/opt/homebrew/bin:${process.env.PATH}`,
      FORCE_COLOR: '1'
    }
  })

  onStart(proc)

  proc.stdout.on('data', (data) => {
    // Convert newlines for terminal display
    const text = data.toString().replace(/\n/g, '\r\n')
    ws.send(text)
  })

  proc.stderr.on('data', (data) => {
    const text = data.toString().replace(/\n/g, '\r\n')
    ws.send(text)
  })

  proc.on('error', (err) => {
    ws.send(`\x1b[31mError: ${err.message}\x1b[0m\r\n`)
    onEnd()
  })

  proc.on('close', (code) => {
    if (code !== 0 && code !== null) {
      ws.send(`\x1b[90m(exit code: ${code})\x1b[0m\r\n`)
    }
    onEnd()
  })
}

console.log(`Terminal WebSocket server running on ws://localhost:${PORT}`)
console.log(`Working directory: ${cliDir}`)
console.log(`\nSupported commands:`)
console.log(`  ./ralph.elv [flags]  - Run Ralph`)
console.log(`  ls, cat, etc.        - Basic shell commands`)
