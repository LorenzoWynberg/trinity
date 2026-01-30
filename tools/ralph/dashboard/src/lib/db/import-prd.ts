/**
 * Import PRD data from JSON files into SQLite database
 * Run with: npx tsx src/lib/db/import-prd.ts
 */
import fs from 'fs/promises'
import path from 'path'
import { getDb } from './index'
import { versions, phases, epics, stories } from './prd'

const PROJECT_ROOT = path.resolve(process.cwd(), '../../..')
const PRD_DIR = path.join(PROJECT_ROOT, 'tools/ralph/cli/prd')

interface JsonPRD {
  title?: string
  shortTitle?: string
  description?: string
  phases?: { id: number; name: string }[]
  epics?: { phase: number; id: number; name: string }[]
  stories?: any[]
}

async function importPRDFromJson(versionId: string, filePath: string): Promise<void> {
  console.log(`Importing ${versionId} from ${filePath}...`)

  const content = await fs.readFile(filePath, 'utf-8')
  const prd: JsonPRD = JSON.parse(content)

  // Create version
  versions.create(versionId, {
    title: prd.title,
    shortTitle: prd.shortTitle,
    description: prd.description
  })
  console.log(`  Created version: ${versionId}`)

  // Import phases
  if (prd.phases && prd.phases.length > 0) {
    phases.bulkCreate(versionId, prd.phases)
    console.log(`  Imported ${prd.phases.length} phases`)
  }

  // Import epics
  if (prd.epics && prd.epics.length > 0) {
    epics.bulkCreate(versionId, prd.epics)
    console.log(`  Imported ${prd.epics.length} epics`)
  }

  // Import stories (prefix ID with version to make unique across versions)
  if (prd.stories && prd.stories.length > 0) {
    const storyList = prd.stories.map(s => ({
      ...s,
      id: `${versionId}:${s.id}`,  // Make ID unique: "v0.1:1.1.1"
      target_version: versionId
    }))
    stories.bulkCreate(storyList)
    console.log(`  Imported ${prd.stories.length} stories`)
  }
}

async function main() {
  // Ensure db is initialized (runs migrations)
  getDb()

  // Find all version JSON files
  const files = await fs.readdir(PRD_DIR)
  const versionFiles = files
    .filter(f => f.match(/^v[\d.]+\.json$/))
    .sort((a, b) => {
      const [, aMajor, aMinor] = a.match(/v(\d+)\.(\d+)/) || [, '0', '0']
      const [, bMajor, bMinor] = b.match(/v(\d+)\.(\d+)/) || [, '0', '0']
      if (aMajor !== bMajor) return parseInt(aMajor) - parseInt(bMajor)
      return parseInt(aMinor) - parseInt(bMinor)
    })

  console.log(`Found ${versionFiles.length} version files: ${versionFiles.join(', ')}`)
  console.log()

  for (const file of versionFiles) {
    const versionId = file.replace('.json', '')
    const filePath = path.join(PRD_DIR, file)
    await importPRDFromJson(versionId, filePath)
    console.log()
  }

  // Summary
  const allVersions = versions.list()
  console.log('Import complete!')
  console.log(`Versions in database: ${allVersions.join(', ')}`)

  for (const v of allVersions) {
    const storyCount = stories.list(v).length
    console.log(`  ${v}: ${storyCount} stories`)
  }
}

main().catch(console.error)
