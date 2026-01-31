import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // ngrok exposes its API on port 4040
    const res = await fetch('http://localhost:4040/api/tunnels')
    const data = await res.json()

    const tunnels: Record<string, string> = {}
    for (const tunnel of data.tunnels || []) {
      // tunnel.name is like "dashboard" or "terminal"
      // tunnel.public_url is the ngrok URL
      tunnels[tunnel.name] = tunnel.public_url
    }

    return NextResponse.json(tunnels)
  } catch {
    // ngrok not running, return empty
    return NextResponse.json({})
  }
}
