# Terminal

The terminal page provides a full interactive shell for running Ralph.

## Architecture

**Components:**
- `ws-server.js` - WebSocket server using node-pty for full PTY
- `terminal-view.tsx` - xterm.js client component

**Running locally:**
```bash
npm run dev           # Next.js + WebSocket + ngrok (if configured)
npm run dev:terminal  # WebSocket server only
npm run dev:next      # Next.js only (no terminal)
```

## Features

- Full PTY shell (zsh) - supports interactive programs
- Tab completion and command history work
- TUI apps like `claude` work properly
- Quick command buttons: Run, Stop, Status, Stats

## tmux Persistence

Sessions persist across page refresh, network disconnects, and browser restarts:

```javascript
// ws-server.js spawns tmux instead of raw shell
const ptyProcess = pty.spawn('tmux', ['new-session', '-A', '-s', 'ralph'], {
  // -A: attach if exists, create if not
  // -s: session name
})
```

Requires `brew install tmux`. Session named "ralph" persists until manually killed (`tmux kill-session -t ralph`).

## ngrok Setup (Remote Access)

For accessing dashboard from phone/remote:

**Config file:** `tools/ralph/dashboard/ngrok.yml` (gitignored - contains authtoken)

```yaml
version: 3
agent:
  authtoken: YOUR_TOKEN
tunnels:
  dashboard:
    addr: 4000
    proto: http
    domain: your-domain.ngrok.app  # Custom domain (no interstitial)
  terminal:
    addr: 4001
    proto: http  # Random URL (shows interstitial once)
```

**Key points:**
- Hobby plan ($10/mo): 3 endpoints, 1 custom domain
- Custom domain = no "Visit Site" interstitial page
- Random URLs still work but show interstitial
- Terminal WebSocket auto-detected via `/api/tunnels` endpoint
- Get authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
- Reserve domains at https://dashboard.ngrok.com/domains
