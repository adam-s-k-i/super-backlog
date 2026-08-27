---
id: TASK-43
title: Release v0.10.0 with dashboard live-sync (SSE + sbl serve)
status: In Progress
assignee:
  - '@adam'
created_date: '2026-08-27 22:48'
updated_date: '2026-08-27 22:49'
labels: []
dependencies: []
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Trigger a new super-backlog release containing the merged dashboard live-sync feature (SSE live-reload and sbl serve command). Local master is 3 commits ahead of origin/master (feat(serve) + chore(ci) OIDC publish fix). Release-please is configured to open a release PR on push to master; merging that PR will create the GitHub release v0.10.0 and trigger the publish workflow for npm.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Push local master to origin/master so release-please sees the feat(serve) commit
- [ ] #2 Release-please creates the release PR (expected version v0.10.0 due to feat bump in 0.x)
- [ ] #3 Merge the release PR to create GitHub release and trigger npm publish
- [ ] #4 Verify the published package version on npm and the GitHub release notes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Push local master to origin/master (3 commits ahead). 2. Wait for release-please workflow to create release PR (check via gh pr list). 3. Merge release PR with gh pr merge --squash or via GitHub UI. 4. Verify GitHub release v0.10.0 created and Publish workflow ran. 5. Verify npm package @super-backlog/super-backlog@0.10.0 published.
<!-- SECTION:PLAN:END -->
