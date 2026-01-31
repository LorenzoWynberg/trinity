import { getDb } from './index'
import * as tagsDb from './tags'
import type { Story, Phase, Epic, PRD } from '../types'

// Version operations
export const versions = {
  list(): string[] {
    const db = getDb()
    const rows = db.prepare('SELECT id FROM versions ORDER BY id').all() as { id: string }[]
    return rows.map(r => r.id)
  },

  get(id: string): { id: string; title?: string; shortTitle?: string; description?: string } | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM versions WHERE id = ?').get(id) as any
    if (!row) return null
    return {
      id: row.id,
      title: row.title,
      shortTitle: row.short_title,
      description: row.description
    }
  },

  create(id: string, data: { title?: string; shortTitle?: string; description?: string }): void {
    const db = getDb()
    db.prepare(`
      INSERT INTO versions (id, title, short_title, description)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        short_title = excluded.short_title,
        description = excluded.description
    `).run(id, data.title || null, data.shortTitle || null, data.description || null)
  },

  delete(id: string): void {
    const db = getDb()
    db.prepare('DELETE FROM versions WHERE id = ?').run(id)
  }
}

// Phase operations
export const phases = {
  list(versionId: string): Phase[] {
    const db = getDb()
    const rows = db.prepare(`
      SELECT id, name FROM phases WHERE version_id = ? ORDER BY id
    `).all(versionId) as { id: number; name: string }[]
    return rows.map(r => ({ id: r.id, name: r.name }))
  },

  create(versionId: string, phase: Phase): void {
    const db = getDb()
    db.prepare(`
      INSERT INTO phases (version_id, id, name)
      VALUES (?, ?, ?)
      ON CONFLICT(version_id, id) DO UPDATE SET name = excluded.name
    `).run(versionId, phase.id, phase.name)
  },

  bulkCreate(versionId: string, phaseList: Phase[]): void {
    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO phases (version_id, id, name)
      VALUES (?, ?, ?)
      ON CONFLICT(version_id, id) DO UPDATE SET name = excluded.name
    `)
    db.transaction(() => {
      for (const phase of phaseList) {
        stmt.run(versionId, phase.id, phase.name)
      }
    })()
  }
}

// Epic operations
export const epics = {
  list(versionId: string): Epic[] {
    const db = getDb()
    const rows = db.prepare(`
      SELECT phase_id as phase, id, name FROM epics WHERE version_id = ? ORDER BY phase_id, id
    `).all(versionId) as Epic[]
    return rows
  },

  create(versionId: string, epic: Epic): void {
    const db = getDb()
    db.prepare(`
      INSERT INTO epics (version_id, phase_id, id, name)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(version_id, phase_id, id) DO UPDATE SET name = excluded.name
    `).run(versionId, epic.phase, epic.id, epic.name)
  },

  bulkCreate(versionId: string, epicList: Epic[]): void {
    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO epics (version_id, phase_id, id, name)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(version_id, phase_id, id) DO UPDATE SET name = excluded.name
    `)
    db.transaction(() => {
      for (const epic of epicList) {
        stmt.run(versionId, epic.phase, epic.id, epic.name)
      }
    })()
  }
}

// Story operations
export const stories = {
  list(versionId?: string): Story[] {
    const db = getDb()
    let sql = 'SELECT * FROM stories'
    const params: string[] = []

    if (versionId && versionId !== 'all') {
      sql += ' WHERE version_id = ?'
      params.push(versionId)
    }

    sql += ' ORDER BY phase, epic, story_number'

    const rows = db.prepare(sql).all(...params) as any[]
    return rows.map(parseStoryRow)
  },

  get(id: string): Story | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM stories WHERE id = ?').get(id) as any
    if (!row) return null
    return parseStoryRow(row)
  },

  create(story: Story): void {
    const db = getDb()
    db.prepare(`
      INSERT INTO stories (
        id, version_id, phase, epic, story_number, title, intent, description,
        acceptance, depends_on, passes, merged, skipped,
        target_branch, working_branch, pr_url, merge_commit,
        external_deps, external_deps_report
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        intent = excluded.intent,
        description = excluded.description,
        acceptance = excluded.acceptance,
        depends_on = excluded.depends_on,
        passes = excluded.passes,
        merged = excluded.merged,
        skipped = excluded.skipped,
        target_branch = excluded.target_branch,
        working_branch = excluded.working_branch,
        pr_url = excluded.pr_url,
        merge_commit = excluded.merge_commit,
        external_deps = excluded.external_deps,
        external_deps_report = excluded.external_deps_report,
        updated_at = datetime('now')
    `).run(
      story.id,
      story.target_version || 'v0.1',
      story.phase,
      story.epic,
      story.story_number || 1,
      story.title,
      story.intent || null,
      story.description || null,
      JSON.stringify(story.acceptance || []),
      JSON.stringify(story.depends_on || []),
      story.passes ? 1 : 0,
      story.merged ? 1 : 0,
      story.skipped ? 1 : 0,
      story.target_branch || 'dev',
      story.working_branch || null,
      story.pr_url || null,
      story.merge_commit || null,
      JSON.stringify(story.external_deps || []),
      story.external_deps_report || null
    )

    // Set tags via junction table
    if (story.tags?.length) {
      tagsDb.setForStory(story.id, story.tags)
    }
  },

  bulkCreate(storyList: Story[]): void {
    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO stories (
        id, version_id, phase, epic, story_number, title, intent, description,
        acceptance, depends_on, passes, merged, skipped,
        target_branch, working_branch, pr_url, merge_commit,
        external_deps, external_deps_report
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        intent = excluded.intent,
        description = excluded.description,
        acceptance = excluded.acceptance,
        depends_on = excluded.depends_on,
        passes = excluded.passes,
        merged = excluded.merged,
        skipped = excluded.skipped,
        target_branch = excluded.target_branch,
        working_branch = excluded.working_branch,
        pr_url = excluded.pr_url,
        merge_commit = excluded.merge_commit,
        external_deps = excluded.external_deps,
        external_deps_report = excluded.external_deps_report,
        updated_at = datetime('now')
    `)

    db.transaction(() => {
      for (const story of storyList) {
        stmt.run(
          story.id,
          story.target_version || 'v0.1',
          story.phase,
          story.epic,
          story.story_number || 1,
          story.title,
          story.intent || null,
          story.description || null,
          JSON.stringify(story.acceptance || []),
          JSON.stringify(story.depends_on || []),
          story.passes ? 1 : 0,
          story.merged ? 1 : 0,
          story.skipped ? 1 : 0,
          story.target_branch || 'dev',
          story.working_branch || null,
          story.pr_url || null,
          story.merge_commit || null,
          JSON.stringify(story.external_deps || []),
          story.external_deps_report || null
        )

        // Set tags via junction table
        if (story.tags?.length) {
          tagsDb.setForStory(story.id, story.tags)
        }
      }
    })()
  },

  update(id: string, updates: Partial<Story>): Story | null {
    const existing = this.get(id)
    if (!existing) return null

    const merged = { ...existing, ...updates }
    this.create(merged)
    return this.get(id)
  },

  delete(id: string): boolean {
    const db = getDb()
    const result = db.prepare('DELETE FROM stories WHERE id = ?').run(id)
    return result.changes > 0
  },

  markPassed(id: string): void {
    const db = getDb()
    db.prepare(`UPDATE stories SET passes = 1, updated_at = datetime('now') WHERE id = ?`).run(id)
  },

  markMerged(id: string, prUrl?: string, mergeCommit?: string): void {
    const db = getDb()
    db.prepare(`
      UPDATE stories
      SET merged = 1, pr_url = COALESCE(?, pr_url), merge_commit = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(prUrl || null, mergeCommit || null, id)
  },

  markSkipped(id: string): void {
    const db = getDb()
    db.prepare(`UPDATE stories SET skipped = 1, updated_at = datetime('now') WHERE id = ?`).run(id)
  },

  setWorkingBranch(id: string, branch: string): void {
    const db = getDb()
    db.prepare(`UPDATE stories SET working_branch = ?, updated_at = datetime('now') WHERE id = ?`).run(branch, id)
  },

  setPrUrl(id: string, prUrl: string): void {
    const db = getDb()
    db.prepare(`UPDATE stories SET pr_url = ?, updated_at = datetime('now') WHERE id = ?`).run(prUrl, id)
  }
}

// Run state operations (simplified - git details now on story)
export const runState = {
  get(): {
    current_story: string | null
    status: string
    attempts: number
    last_completed: string | null
    last_error: string | null
  } {
    const db = getDb()
    const row = db.prepare('SELECT * FROM run_state WHERE id = 1').get() as any
    return {
      current_story: row?.current_story || null,
      status: row?.status || 'idle',
      attempts: row?.attempts || 0,
      last_completed: row?.last_completed || null,
      last_error: row?.last_error || null
    }
  },

  update(updates: Partial<{
    current_story: string | null
    status: string
    attempts: number
    last_completed: string | null
    last_error: string | null
  }>): void {
    const db = getDb()
    const fields: string[] = []
    const values: any[] = []

    if ('current_story' in updates) {
      fields.push('current_story = ?')
      values.push(updates.current_story)
    }
    if ('status' in updates) {
      fields.push('status = ?')
      values.push(updates.status)
    }
    if ('attempts' in updates) {
      fields.push('attempts = ?')
      values.push(updates.attempts)
    }
    if ('last_completed' in updates) {
      fields.push('last_completed = ?')
      values.push(updates.last_completed)
    }
    if ('last_error' in updates) {
      fields.push('last_error = ?')
      values.push(updates.last_error)
    }

    if (fields.length === 0) return

    fields.push("last_updated = datetime('now')")

    db.prepare(`UPDATE run_state SET ${fields.join(', ')} WHERE id = 1`).run(...values)
  },

  reset(): void {
    const db = getDb()
    db.prepare(`
      UPDATE run_state SET
        current_story = NULL,
        status = 'idle',
        attempts = 0,
        last_error = NULL,
        last_updated = datetime('now')
      WHERE id = 1
    `).run()
  }
}

// Checkpoint operations
export const checkpoints = {
  get(storyId: string, stage: string): { data: any } | null {
    const db = getDb()
    const row = db.prepare('SELECT data FROM checkpoints WHERE story_id = ? AND stage = ?').get(storyId, stage) as any
    if (!row) return null
    return { data: row.data ? JSON.parse(row.data) : null }
  },

  save(storyId: string, stage: string, data?: any): void {
    const db = getDb()
    db.prepare(`
      INSERT INTO checkpoints (story_id, stage, data)
      VALUES (?, ?, ?)
      ON CONFLICT(story_id, stage) DO UPDATE SET
        data = excluded.data,
        created_at = datetime('now')
    `).run(storyId, stage, data ? JSON.stringify(data) : null)
  },

  clear(storyId: string): void {
    const db = getDb()
    db.prepare('DELETE FROM checkpoints WHERE story_id = ?').run(storyId)
  },

  clearStage(storyId: string, stage: string): void {
    const db = getDb()
    db.prepare('DELETE FROM checkpoints WHERE story_id = ? AND stage = ?').run(storyId, stage)
  }
}

// Execution log operations (replaces story_metrics)
export const executionLog = {
  start(storyId: string, attempt: number = 1): number {
    const db = getDb()
    const result = db.prepare(`
      INSERT INTO execution_log (story_id, attempt, status)
      VALUES (?, ?, 'running')
    `).run(storyId, attempt)
    return result.lastInsertRowid as number
  },

  complete(id: number, tokens: { input: number; output: number }, durationSeconds: number): void {
    const db = getDb()
    db.prepare(`
      UPDATE execution_log
      SET status = 'complete',
          finished_at = datetime('now'),
          duration_seconds = ?,
          input_tokens = ?,
          output_tokens = ?
      WHERE id = ?
    `).run(durationSeconds, tokens.input, tokens.output, id)
  },

  fail(id: number, errorMessage: string): void {
    const db = getDb()
    db.prepare(`
      UPDATE execution_log
      SET status = 'error',
          finished_at = datetime('now'),
          error_message = ?
      WHERE id = ?
    `).run(errorMessage, id)
  },

  block(id: number, reason: string): void {
    const db = getDb()
    db.prepare(`
      UPDATE execution_log
      SET status = 'blocked',
          finished_at = datetime('now'),
          error_message = ?
      WHERE id = ?
    `).run(reason, id)
  },

  getForStory(storyId: string): {
    id: number
    attempt: number
    started_at: string
    finished_at: string | null
    duration_seconds: number | null
    input_tokens: number
    output_tokens: number
    status: string
    error_message: string | null
  }[] {
    const db = getDb()
    return db.prepare(`
      SELECT * FROM execution_log WHERE story_id = ? ORDER BY started_at DESC
    `).all(storyId) as any[]
  },

  getTotals(): {
    total_runs: number
    total_input_tokens: number
    total_output_tokens: number
    total_duration_seconds: number
    completed_stories: number
  } {
    const db = getDb()
    const row = db.prepare(`
      SELECT
        COUNT(*) as total_runs,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        COALESCE(SUM(duration_seconds), 0) as total_duration_seconds,
        COUNT(DISTINCT CASE WHEN status = 'complete' THEN story_id END) as completed_stories
      FROM execution_log
    `).get() as any
    return row
  }
}

// Helper to parse story row from DB
function parseStoryRow(row: any): Story {
  return {
    id: row.id,
    title: row.title,
    intent: row.intent,
    description: row.description,
    acceptance: JSON.parse(row.acceptance || '[]'),
    depends_on: JSON.parse(row.depends_on || '[]'),
    tags: tagsDb.getForStory(row.id).map(t => t.name),
    phase: row.phase,
    epic: row.epic,
    story_number: row.story_number,
    target_version: row.version_id,
    passes: row.passes === 1,
    merged: row.merged === 1,
    skipped: row.skipped === 1,
    target_branch: row.target_branch || 'dev',
    working_branch: row.working_branch,
    pr_url: row.pr_url,
    merge_commit: row.merge_commit,
    external_deps: JSON.parse(row.external_deps || '[]'),
    external_deps_report: row.external_deps_report
  }
}

// Get full PRD for a version (convenience function)
export function getPRD(versionId: string): PRD | null {
  const version = versions.get(versionId)
  if (!version) return null

  const phaseList = phases.list(versionId)
  const epicList = epics.list(versionId)
  const storyList = stories.list(versionId)

  // Build name lookups and enrich stories
  const phaseNames = new Map<number, string>()
  const epicNames = new Map<string, string>()

  for (const p of phaseList) {
    phaseNames.set(p.id, p.name)
  }
  for (const e of epicList) {
    epicNames.set(`${e.phase}-${e.id}`, e.name)
  }

  const enrichedStories = storyList.map(s => ({
    ...s,
    phase_name: phaseNames.get(s.phase),
    epic_name: epicNames.get(`${s.phase}-${s.epic}`)
  }))

  return {
    project: version.title || versionId,
    version: versionId,
    title: version.title,
    shortTitle: version.shortTitle,
    description: version.description,
    phases: phaseList,
    epics: epicList,
    stories: enrichedStories
  }
}

// Get all PRDs combined
export function getAllPRDs(): PRD | null {
  const versionList = versions.list()
  if (versionList.length === 0) return null

  const allStories: Story[] = []
  const allPhases: Phase[] = []
  const allEpics: Epic[] = []
  let projectName = ''

  for (const versionId of versionList) {
    const prd = getPRD(versionId)
    if (prd) {
      projectName = prd.project
      allStories.push(...prd.stories)

      // Merge phases (dedup by id)
      for (const p of prd.phases || []) {
        if (!allPhases.find(x => x.id === p.id)) {
          allPhases.push(p)
        }
      }
      // Merge epics (dedup by phase+id)
      for (const e of prd.epics || []) {
        if (!allEpics.find(x => x.phase === e.phase && x.id === e.id)) {
          allEpics.push(e)
        }
      }
    }
  }

  return {
    project: projectName,
    version: 'all',
    phases: allPhases,
    epics: allEpics,
    stories: allStories
  }
}
