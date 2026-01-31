/**
 * Seed the database with PRD data and documentation
 * Run with: npx tsx src/lib/db/seed.ts
 *
 * Options:
 *   --clean  Delete existing database before seeding
 */

import fs from 'fs/promises'
import path from 'path'
import { getDb } from './index'
import { versions, phases, epics, stories } from './prd'
import { importAllDocs } from './import-docs'

const PRD_DIR = path.join(process.cwd(), 'prd-backup')
const DB_PATH = path.join(process.cwd(), 'dashboard.db')

interface JsonPRD {
  title?: string
  shortTitle?: string
  description?: string
  phases?: { id: number; name: string }[]
  epics?: { phase: number; id: number; name: string }[]
  stories?: any[]
}

async function importPRDFromJson(versionId: string, filePath: string): Promise<number> {
  console.log(`  Importing ${versionId}...`)

  const content = await fs.readFile(filePath, 'utf-8')
  const prd: JsonPRD = JSON.parse(content)

  // Check if version already exists
  const existingVersions = versions.list()
  if (existingVersions.includes(versionId)) {
    console.log(`    Skipping ${versionId} (already exists)`)
    return 0
  }

  // Create version
  versions.create(versionId, {
    title: prd.title,
    shortTitle: prd.shortTitle,
    description: prd.description
  })

  // Import phases
  if (prd.phases && prd.phases.length > 0) {
    phases.bulkCreate(versionId, prd.phases)
  }

  // Import epics
  if (prd.epics && prd.epics.length > 0) {
    epics.bulkCreate(versionId, prd.epics)
  }

  // Import stories
  // Story ID must include version prefix for uniqueness across versions (e.g., "v0.1:1.1.1")
  let storyCount = 0
  if (prd.stories && prd.stories.length > 0) {
    const storyList = prd.stories.map(s => ({
      ...s,
      id: `${versionId}:${s.id}`,
      target_version: versionId
    }))
    stories.bulkCreate(storyList)
    storyCount = prd.stories.length
  }

  console.log(`    ${prd.phases?.length || 0} phases, ${prd.epics?.length || 0} epics, ${storyCount} stories`)
  return storyCount
}

async function importAllPRDs(): Promise<{ versions: number; stories: number }> {
  console.log('\n📋 Importing PRD data...')

  // Check if PRD directory exists
  try {
    await fs.access(PRD_DIR)
  } catch {
    console.log('  No prd-backup directory found, skipping PRD import')
    return { versions: 0, stories: 0 }
  }

  const files = await fs.readdir(PRD_DIR)
  const versionFiles = files
    .filter(f => f.match(/^v[\d.]+\.json$/))
    .sort((a, b) => {
      const [, aMajor, aMinor] = a.match(/v(\d+)\.(\d+)/) || [, '0', '0']
      const [, bMajor, bMinor] = b.match(/v(\d+)\.(\d+)/) || [, '0', '0']
      if (aMajor !== bMajor) return parseInt(aMajor) - parseInt(bMajor)
      return parseInt(aMinor) - parseInt(bMinor)
    })

  let totalStories = 0
  for (const file of versionFiles) {
    const versionId = file.replace('.json', '')
    const filePath = path.join(PRD_DIR, file)
    totalStories += await importPRDFromJson(versionId, filePath)
  }

  return { versions: versionFiles.length, stories: totalStories }
}

async function main() {
  const args = process.argv.slice(2)
  const clean = args.includes('--clean')

  if (clean) {
    console.log('🗑️  Cleaning existing database...')
    try {
      await fs.unlink(DB_PATH)
      console.log('  Deleted dashboard.db')
    } catch {
      console.log('  No existing database to delete')
    }
  }

  console.log('🔧 Initializing database (running migrations)...')
  getDb()

  // Import PRDs
  const prdResult = await importAllPRDs()

  // Import documentation
  console.log('\n📚 Importing documentation...')
  const docsResult = importAllDocs()

  // Summary
  console.log('\n✅ Seed complete!')
  console.log(`   PRD: ${prdResult.versions} versions, ${prdResult.stories} stories`)
  console.log(`   Knowledge: ${docsResult.knowledge.chapters} chapters, ${docsResult.knowledge.pages} pages`)
  console.log(`   Gotchas: ${docsResult.gotchas.chapters} chapters, ${docsResult.gotchas.pages} pages`)

  // Show versions
  const allVersions = versions.list()
  if (allVersions.length > 0) {
    console.log('\n   Versions in database:')
    for (const v of allVersions) {
      const storyCount = stories.list(v).length
      const merged = stories.list(v).filter(s => s.merged).length
      console.log(`     ${v}: ${merged}/${storyCount} stories merged`)
    }
  }
}

main().catch(console.error)
