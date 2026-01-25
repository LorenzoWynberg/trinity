import { getActivityLogs, getActivityProjects } from '@/lib/data'
import { ActivityClient } from './activity-client'

export const revalidate = 5

export default async function ActivityPage() {
  const projects = await getActivityProjects()
  const defaultProject = projects.includes('trinity') ? 'trinity' : projects[0]
  const logs = await getActivityLogs(defaultProject)

  return (
    <ActivityClient
      initialLogs={logs}
      initialProject={defaultProject}
      projects={projects}
    />
  )
}
