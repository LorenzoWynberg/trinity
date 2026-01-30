/**
 * Git Operations - For execution loop
 * Handles branch management, commits, PRs
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

const PROJECT_ROOT = path.resolve(process.cwd(), '../../..')

interface GitResult {
  success: boolean
  output?: string
  error?: string
}

/**
 * Run a git command
 */
async function runGit(args: string, cwd: string = PROJECT_ROOT): Promise<GitResult> {
  try {
    const { stdout, stderr } = await execAsync(`git ${args}`, { cwd })
    return { success: true, output: stdout.trim() }
  } catch (error: any) {
    return { success: false, error: error.message || error.stderr }
  }
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(): Promise<string | null> {
  const result = await runGit('rev-parse --abbrev-ref HEAD')
  return result.success ? result.output || null : null
}

/**
 * Check if branch exists (local or remote)
 */
export async function branchExists(branchName: string): Promise<boolean> {
  const local = await runGit(`rev-parse --verify ${branchName}`)
  if (local.success) return true

  const remote = await runGit(`rev-parse --verify origin/${branchName}`)
  return remote.success
}

/**
 * Create and checkout a new branch from base
 */
export async function createBranch(branchName: string, baseBranch: string = 'dev'): Promise<GitResult> {
  // Make sure we're up to date
  await runGit(`fetch origin ${baseBranch}`)

  // Create branch from origin/base
  const result = await runGit(`checkout -b ${branchName} origin/${baseBranch}`)
  return result
}

/**
 * Checkout existing branch
 */
export async function checkoutBranch(branchName: string): Promise<GitResult> {
  return runGit(`checkout ${branchName}`)
}

/**
 * Get list of changed files
 */
export async function getChangedFiles(): Promise<string[]> {
  const result = await runGit('diff --name-only HEAD')
  if (!result.success || !result.output) return []
  return result.output.split('\n').filter(Boolean)
}

/**
 * Stage all changes
 */
export async function stageAll(): Promise<GitResult> {
  return runGit('add -A')
}

/**
 * Commit with message
 */
export async function commit(message: string): Promise<GitResult> {
  // Escape message for shell
  const escaped = message.replace(/'/g, "'\\''")
  return runGit(`commit -m '${escaped}'`)
}

/**
 * Push branch to origin
 */
export async function push(branchName: string): Promise<GitResult> {
  return runGit(`push -u origin ${branchName}`)
}

/**
 * Get current commit hash
 */
export async function getCurrentCommit(): Promise<string | null> {
  const result = await runGit('rev-parse HEAD')
  return result.success ? result.output || null : null
}

/**
 * Check if working directory is clean
 */
export async function isClean(): Promise<boolean> {
  const result = await runGit('status --porcelain')
  return result.success && !result.output
}

/**
 * Create PR using gh CLI
 */
export async function createPR(
  title: string,
  body: string,
  baseBranch: string = 'dev'
): Promise<{ success: boolean; url?: string; error?: string }> {
  const escaped_title = title.replace(/'/g, "'\\''")
  const escaped_body = body.replace(/'/g, "'\\''")

  const result = await runGit(
    `pr create --title '${escaped_title}' --body '${escaped_body}' --base ${baseBranch}`,
    PROJECT_ROOT
  )

  if (!result.success) {
    // Check if PR already exists
    const existing = await runGit('pr view --json url')
    if (existing.success && existing.output) {
      try {
        const parsed = JSON.parse(existing.output)
        return { success: true, url: parsed.url }
      } catch {}
    }
    return { success: false, error: result.error }
  }

  // Extract URL from output
  const urlMatch = result.output?.match(/https:\/\/github\.com\/[^\s]+/)
  return { success: true, url: urlMatch?.[0] }
}

/**
 * Merge PR using gh CLI
 */
export async function mergePR(branchName: string): Promise<GitResult> {
  return runGit(`pr merge ${branchName} --squash --delete-branch`)
}

/**
 * Get PR status for branch
 */
export async function getPRStatus(branchName: string): Promise<{
  exists: boolean
  url?: string
  state?: 'OPEN' | 'MERGED' | 'CLOSED'
}> {
  const result = await runGit(`pr view ${branchName} --json url,state`)

  if (!result.success) {
    return { exists: false }
  }

  try {
    const parsed = JSON.parse(result.output || '{}')
    return { exists: true, url: parsed.url, state: parsed.state }
  } catch {
    return { exists: false }
  }
}

/**
 * Delete local branch
 */
export async function deleteBranch(branchName: string): Promise<GitResult> {
  return runGit(`branch -D ${branchName}`)
}

/**
 * Abort any in-progress merge/rebase
 */
export async function abortMerge(): Promise<void> {
  await runGit('merge --abort')
  await runGit('rebase --abort')
}

/**
 * Reset to clean state
 */
export async function resetHard(): Promise<GitResult> {
  return runGit('reset --hard HEAD')
}

/**
 * Build branch name from story ID
 */
export function buildBranchName(storyId: string): string {
  // Handle both "1.2.3" and "STORY-1.2.3" formats
  const normalized = storyId.replace(/^STORY-/, '')
  return `feat/story-${normalized}`
}
