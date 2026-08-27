---
id: TASK-28
title: Wire Docs-Gate job into pr-hygiene workflow
status: Done
assignee: []
created_date: '2026-08-27 12:00'
updated_date: '2026-08-27 13:09'
labels:
  - ci
dependencies:
  - TASK-27
references:
  - docs/superpowers/specs/2026-08-27-docs-freshness-gate-design.md
type: chore
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a Docs-Gate job to .github/workflows/pr-hygiene.yml that runs scripts/check-docs-required.mjs on pull requests with fetch-depth 0, reading PR title and labels from the GitHub event. Blocks feature PRs that ship without docs updates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 pr-hygiene.yml contains a Docs-Gate job that runs the gate script on pull_request events with fetch-depth 0
- [x] #2 Job fails with an actionable error message when the gate is violated
- [x] #3 Script supports local manual runs via --title, --labels and --base flags
- [x] #4 The wiring PR itself passes the gate (it is a feat: PR including a docs change)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence: Docs-Gate job live in pr-hygiene.yml (SHA-pinned checkout, fetch-depth 0, explicit base fetch). Real CI runs on PR #25: pass 7s and 8s. Violation path demonstrated locally: src/-only change exits 1 with actionable message. Local flags --title/--labels/--base smoke-tested. no-docs label created on repo.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Wired the Docs-Gate job into pr-hygiene.yml (between Labels and Auto-merge, permissions:{}, fork-safe). Verified by real PR #25 check runs (green) and local failure-path simulation (exit 1 with message). Merged via PR #25 (94431b7).
<!-- SECTION:FINAL_SUMMARY:END -->
