# Release Workflow Implementation Checklist

## Phase 1: Foundation

- [x] Add CLI flags to `lib/cli.elv`
  - [x] `--skip-release` flag
  - [x] `--auto-release` flag
  - [x] `--release-tag <tag>` flag
  - [x] Update `get-config` to include new flags

- [x] Create `lib/release.elv` module skeleton
  - [x] Module imports and variables
  - [x] `init` function
  - [x] Function stubs for all release operations

- [x] Add PRD schema extensions to `lib/prd.elv`
  - [x] `mark-version-released` function
  - [x] `is-version-released` function
  - [x] `get-stories-summary` function
  - [x] `get-story-count` function

## Phase 2: Release Summary & Human Gate

- [x] Implement `release:show-summary`
  - [x] Count completed stories by epic
  - [x] Get commit count (dev ahead of main)
  - [x] Get files changed stats
  - [x] Format and display summary

- [x] Implement `release:prompt-approval`
  - [x] Display options: [y]es / [n]o / [e]dit tag / [f]eedback
  - [x] Handle tag editing
  - [x] Return action map with choice and tag

## Phase 3: Hotfix Flow

- [x] Implement `release:run-hotfix`
  - [x] Open editor for feedback input
  - [x] Create hotfix branch from dev
  - [x] Build Claude prompt with feedback
  - [x] Run Claude (with --dangerously-skip-permissions)
  - [x] Commit changes to hotfix branch
  - [x] Create PR: hotfix → dev
  - [x] Merge PR
  - [x] Delete hotfix branch
  - [x] Return success/failure

## Phase 4: Release Execution

- [x] Implement `release:create-release-pr`
  - [x] Generate PR title: "Release {version}"
  - [x] Generate PR body from completed stories
  - [x] Create PR: dev → main
  - [x] Return PR URL/number

- [x] Implement `release:merge-release-pr`
  - [x] Merge the PR (using --merge, not squash)
  - [x] Return merge commit SHA

- [x] Implement `release:create-tag`
  - [x] Checkout main
  - [x] Pull latest
  - [x] Create annotated tag at merge commit
  - [x] `git tag -a {tag} -m "Release {tag}"`

- [x] Implement `release:push-tag`
  - [x] Push tag to origin
  - [x] `git push origin {tag}`

- [x] Implement `release:mark-released` (via prd.elv)
  - [x] Update prd.json with:
    - [x] `released: true`
    - [x] `released_at: timestamp`
    - [x] `release_tag: tag`
    - [x] `release_commit: sha`

- [x] Implement `release:run` (orchestrator)
  - [x] Call create-release-pr
  - [x] Call merge-release-pr
  - [x] Call create-tag
  - [x] Call push-tag
  - [x] Checkout back to dev
  - [x] Call mark-released
  - [x] Return result map

## Phase 5: Integration

- [x] Update `ralph.elv` main loop
  - [x] Add release module import
  - [x] Add release check after all-stories-complete
  - [x] Integrate human gate flow
  - [x] Integrate hotfix loop
  - [x] Integrate release execution

- [x] Update `lib/ui.elv`
  - [x] Update help text with release options

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
| `lib/release.elv` | [x] Create |
| `lib/cli.elv` | [x] Modify |
| `lib/prd.elv` | [x] Modify |
| `ralph.elv` | [x] Modify |
| `lib/ui.elv` | [x] Modify |
