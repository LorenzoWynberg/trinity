import { NextRequest, NextResponse } from 'next/server'
import { getActivityLogs, type ActivityProject } from '@/lib/data'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const project = searchParams.get('project') as ActivityProject | null

  const validProject = project === 'ralph' ? 'ralph' : 'trinity'
  const logs = await getActivityLogs(validProject)

  return NextResponse.json({ logs, project: validProject })
}
