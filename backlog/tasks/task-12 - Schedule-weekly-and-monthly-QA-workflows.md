---
id: TASK-12
title: Schedule weekly and monthly QA workflows
status: Done
assignee: []
created_date: '2026-08-26 02:03'
updated_date: '2026-08-27 13:45'
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
- [x] #1 Weekly cron runs the test matrix across windows/ubuntu and Node 20 and 22
- [x] #2 npm audit findings open an issue containing the audit excerpt
- [x] #3 Outdated dependencies update one long-lived Dependency Health issue instead of creating new ones
- [x] #4 Monthly job packs, extracts the tarball to a temp dir, smoke-tests cli.js --version and --help, and regenerates the dashboard
- [x] #5 Monthly healthcheck requires HTTP 200 plus a keyword from the live Pages URL and opens an issue on failure
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Already implemented (github-automation workstream), task was never closed. Evidence: qa-weekly.yml (cron 0 4 * * 1, matrix windows/ubuntu x Node 20/22/24) with successful runs 33012558138 and 32931450734; report-audit.mjs opens 'npm audit findings' issue with severity table + raw audit JSON; report-health.mjs updates single long-lived issue (Dependency Health #10 exists, updated via comment); qa-monthly.yml Package-smoke (pack, extract, cli.js --version/--help, dashboard regen with size check) with successful run 32930706992; Pages-healthcheck requires HTTP 200 + keyword and opens issue via report-to-issue.mjs on failure.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Weekly and monthly QA workflows were already live and proven by successful dispatch runs; verified every acceptance criterion against the workflows, reporter scripts and the existing Dependency Health issue #10. Closing without code changes.
<!-- SECTION:FINAL_SUMMARY:END -->
