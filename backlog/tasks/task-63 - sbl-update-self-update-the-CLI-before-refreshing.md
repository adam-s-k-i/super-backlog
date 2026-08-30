---
id: TASK-63
title: 'sbl update: self-update the CLI before refreshing'
status: To Do
assignee: []
created_date: '2026-08-30 10:47'
labels:
  - cli
dependencies: []
type: feature
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
New src/lib/self-update.ts: detectInstallKind (global npm prefix vs project node_modules vs unknown) and runSelfUpdate (fetch latest via version-check fetcher with a generous timeout, compare with isNewerVersion, run npm i -g super-backlog@<latest> for global installs only). runUpdate calls it first and re-execs the NEW binary for the project refresh (env guard SBL_SELF_UPDATED=1 against loops, exit code forwarded). Opt-outs: --no-self flag and SBL_SKIP_UPDATE_CHECK. Failures (offline, npm error) warn and continue with the old version; local installs get a hint only, the project package.json is never touched.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Global install + newer version on npm: sbl update installs it and the refresh runs via the new binary exactly once
- [ ] #2 --no-self, SBL_SELF_UPDATED=1 and SBL_SKIP_UPDATE_CHECK each skip the self-update
- [ ] #3 Offline or failed npm install degrades to a warning; refresh still completes with the old version
- [ ] #4 Local (devDependency) installs are never modified; a hint is printed instead
- [ ] #5 Unit tests cover install-kind detection and the decision logic with injected deps (no real npm)
<!-- AC:END -->
