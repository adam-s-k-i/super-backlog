---
id: TASK-45
title: Remove static project dashboard; make sbl dashboard serve-only
status: Done
assignee: []
created_date: '2026-08-28 16:24'
updated_date: '2026-08-28 16:55'
labels: []
dependencies: []
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Drop the static project dashboard.html artifact from user projects. sbl dashboard should always start the dynamic local server (temp file, no project file). sbl init no longer generates a dashboard or installs the post-commit refresh hook. The repo's own Pages demo dashboard continues to be generated internally for docs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 sbl dashboard starts the server, accepts --port/--no-open, and writes no dashboard.html in the project root
- [x] #2 sbl serve remains usable as an alias for sbl dashboard
- [x] #3 sbl init does not generate dashboard.html or install the refresh hook; existing files are still removed by sbl uninstall
- [x] #4 Dashboard template no longer contains static file:// fallback for quick actions
- [x] #5 Pages CI builds docs/public/dashboard.html via an internal script, not the public sbl dashboard --out
- [x] #6 Tests, CLI help, and init integration tests are updated and pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Refactor src/commands/dashboard.ts: runDashboard always writes a temp HTML file and starts the serve server; spawn Backlog browser like runServe did. Remove --serve and --out from user-facing options. 2. Make src/commands/serve.ts a thin re-export/alias to runDashboard. 3. Update CLI help in src/cli.ts. 4. Remove generate-dashboard action and install-refresh-hook from init planner and execute; remove --no-dashboard/--no-refresh-hook flags. 5. Remove installRefreshHook from src/lib/hooks.ts but keep removeRefreshHook for uninstall. 6. Remove static file:// quick-action fallback from src/templates/dashboard.html (same-origin only). 7. Create scripts/generate-dashboard.mjs for Pages CI to write docs/public/dashboard.html directly. 8. Update pages-deploy.yml to use the new script. 9. Update affected tests (serve-command, init integration, hook-regen, hooks, uninstall, render tests as needed). 10. Run npm test && npm run lint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed src/dashboard/regen.ts and test/e2e/hook-regen.e2e.test.ts; updated dashboard template footer/button text and unit snapshot; updated README/docs.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented serve-only dashboard: sbl dashboard writes a temp HTML file and starts the local server; sbl serve is an alias; init no longer generates dashboard.html or installs the refresh hook; Pages CI uses scripts/generate-dashboard.mjs. Full suite: 353 passed / 3 skipped; lint clean.
<!-- SECTION:FINAL_SUMMARY:END -->
