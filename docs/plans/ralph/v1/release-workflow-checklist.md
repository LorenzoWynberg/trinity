# Release Workflow Implementation Checklist

## Phase 1: Foundation

- [ ] Add CLI flags to `lib/cli.elv`
  - [ ] `--skip-release` flag
  - [ ] `--auto-release` flag
  - [ ] `--release-tag <tag>` flag
  - [ ] Update `get-config` to include new flags

- [ ] Create `lib/release.elv` module skeleton
  - [ ] Module imports and variables
  - [ ] `init` function
  - [ ] Function stubs for all release operations

- [ ] Add PRD schema extensions to `lib/prd.elv`
  - [ ] `mark-version-released` function
  - [ ] `is-version-released` function
  - [ ] `get-version-stories` function

## Phase 2: Release Summary & Human Gate

- [ ] Implement `release:show-summary`
  - [ ] Count completed stories by epic
  - [ ] Get commit count (dev ahead of main)
  - [ ] Get files changed stats
  - [ ] Format and display summary

- [ ] Implement `release:prompt-approval`
  - [ ] Display options: [Y]es / [n]o / [e]dit tag / [f]eedback
  - [ ] Handle tag editing
  - [ ] Return action map with choice and tag

## Phase 3: Hotfix Flow

- [ ] Implement `release:run-hotfix`
  - [ ] Open editor for feedback input
  - [ ] Create hotfix branch from dev
  - [ ] Build Claude prompt with feedback
  - [ ] Run Claude (with --dangerously-skip-permissions)
  - [ ] Commit changes to hotfix branch
  - [ ] Create PR: hotfix → dev
  - [ ] Merge PR
  - [ ] Delete hotfix branch
  - [ ] Return success/failure

## Phase 4: Release Execution

- [ ] Implement `release:create-release-pr`
  - [ ] Generate PR title: "Release {version}"
  - [ ] Generate PR body from completed stories
  - [ ] Create PR: dev → main
  - [ ] Return PR URL/number

- [ ] Implement `release:merge-release-pr`
  - [ ] Squash merge the PR
  - [ ] Return merge commit SHA

- [ ] Implement `release:create-tag`
  - [ ] Checkout main
  - [ ] Pull latest
  - [ ] Create annotated tag at merge commit
  - [ ] `git tag -a {tag} -m "Release {tag}"`

- [ ] Implement `release:push-tag`
  - [ ] Push tag to origin
  - [ ] `git push origin {tag}`

- [ ] Implement `release:mark-released`
  - [ ] Update prd.json with:
    - [ ] `released: true`
    - [ ] `released_at: timestamp`
    - [ ] `release_tag: tag`
    - [ ] `release_commit: sha`

- [ ] Implement `release:run` (orchestrator)
  - [ ] Call create-release-pr
  - [ ] Call merge-release-pr
  - [ ] Call create-tag
  - [ ] Call push-tag
  - [ ] Checkout back to dev
  - [ ] Call mark-released
  - [ ] Return result map

## Phase 5: Integration

- [ ] Update `ralph.elv` main loop
  - [ ] Add release module import
  - [ ] Add release check after all-stories-complete
  - [ ] Integrate human gate flow
  - [ ] Integrate hotfix loop
  - [ ] Integrate release execution

- [ ] Update `lib/ui.elv`
  - [ ] Add release-related UI helpers
  - [ ] Update help text with release options

## Phase 6: Testing

- [ ] Test release summary display
- [ ] Test human gate options (Y/n/e/f)
- [ ] Test tag editing
- [ ] Test feedback/hotfix flow
- [ ] Test PR creation to main
- [ ] Test tag creation on main
- [ ] Test prd.json update
- [ ] Test `--skip-release` flag
- [ ] Test `--auto-release` flag
- [ ] Test `--release-tag` custom tag

## Files to Create/Modify

| File | Status |
|------|--------|
| `lib/release.elv` | [ ] Create |
| `lib/cli.elv` | [ ] Modify |
| `lib/prd.elv` | [ ] Modify |
| `ralph.elv` | [ ] Modify |
| `lib/ui.elv` | [ ] Modify |
