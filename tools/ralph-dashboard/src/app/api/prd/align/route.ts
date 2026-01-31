import { NextRequest, NextResponse } from 'next/server'
import * as prdDb from '@/lib/db/prd'

// PUT: Apply alignment changes (modifications, new stories, removals)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { version, modifications, newStories, removals } = body

    if (!version) {
      return NextResponse.json({ error: 'version is required' }, { status: 400 })
    }

    const prd = prdDb.getPRD(version)
    if (!prd) {
      return NextResponse.json({ error: `Version ${version} not found` }, { status: 404 })
    }

    let applied = 0
    let added = 0
    let removed = 0

    // Apply modifications to existing stories
    if (modifications && Array.isArray(modifications)) {
      for (const mod of modifications) {
        const story = prdDb.stories.get(mod.story_id)
        if (!story) continue

        const changes: any = {}
        if (mod.suggested_title) {
          changes.title = mod.suggested_title
        }
        if (mod.suggested_intent) {
          changes.intent = mod.suggested_intent
        }
        if (mod.suggested_acceptance) {
          changes.acceptance = mod.suggested_acceptance
        }

        if (Object.keys(changes).length > 0) {
          prdDb.stories.update(mod.story_id, changes)
          applied++
        }
      }
    }

    // Add new stories
    if (newStories && Array.isArray(newStories)) {
      // Find max story numbers per phase.epic
      const maxStoryNumbers = new Map<string, number>()
      for (const s of prd.stories) {
        const key = `${s.phase}.${s.epic}`
        const current = maxStoryNumbers.get(key) || 0
        if (s.story_number && s.story_number > current) {
          maxStoryNumbers.set(key, s.story_number)
        }
      }

      const storiesToAdd = newStories.map((s: any) => {
        const key = `${s.phase}.${s.epic}`
        const nextNum = (maxStoryNumbers.get(key) || 0) + 1
        maxStoryNumbers.set(key, nextNum)

        return {
          id: `${version}:${s.phase}.${s.epic}.${nextNum}`,
          title: s.title,
          intent: s.intent,
          acceptance: s.acceptance || [],
          phase: s.phase,
          epic: s.epic,
          story_number: nextNum,
          target_version: version,
          depends_on: s.depends_on || [],
          tags: s.tags || [],
          passes: false,
          merged: false,
          skipped: false
        }
      })

      prdDb.stories.bulkCreate(storiesToAdd)
      added = storiesToAdd.length
    }

    // Remove stories (soft delete by marking as skipped with reason)
    if (removals && Array.isArray(removals)) {
      for (const storyId of removals) {
        const story = prdDb.stories.get(storyId)
        if (!story) continue

        prdDb.stories.update(storyId, {
          skipped: true,
          skip_reason: 'Removed during alignment - does not serve vision'
        })
        removed++
      }
    }

    return NextResponse.json({
      applied,
      added,
      removed,
      success: true
    })
  } catch (error: any) {
    console.error('Apply align changes error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
