---
id: TASK-12
title: Schedule weekly and monthly QA workflows
status: Done
assignee:
  - '@ox-alpha'
created_date: '2026-08-26 02:03'
updated_date: '2026-08-26 04:11'
labels:
  - ci
  - qa
dependencies:
  - TASK-8
priority: medium
type: chore
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
qa-weekly.yml (Mondays ~04:00 UTC): full windows/ubuntu x Node 20/22 matrix, npm audit issue on vulnerabilities, one long-lived Dependency Health issue updated weekly. qa-monthly.yml (1st of month): tarball extraction CLI smoke test, dashboard regeneration check, live Pages healthcheck.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Weekly cron runs the test matrix across windows/ubuntu and Node 20 and 22
- [ ] #2 npm audit findings open an issue containing the audit excerpt
- [ ] #3 Outdated dependencies update one long-lived Dependency Health issue instead of creating new ones
- [ ] #4 Monthly job packs, extracts the tarball to a temp dir, smoke-tests cli.js --version and --help, and regenerates the dashboard
- [ ] #5 Monthly healthcheck requires HTTP 200 plus a keyword from the live Pages URL and opens an issue on failure
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Per plan Task 6: report-audit.mjs + report-health.mjs wrappers on report-to-issue core; qa-weekly.yml cron Mon 04:00 UTC (matrix 20/22 both OS, audit issue, Dependency Health issue); qa-monthly.yml cron 1st (tarball smoke, dashboard regen, Pages healthcheck).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done (cca1f4f): qa-weekly.yml (Mon 04:00 UTC, matrix win/ubuntu x Node 20/22, audit issue via report-audit.mjs, Dependency Health issue via report-health.mjs) and qa-monthly.yml (tarball smoke, dashboard regen check, Pages healthcheck with ci-failure issue). docs.test.ts path fixed after guide migration; 135/135 tests green.
<!-- SECTION:NOTES:END -->
