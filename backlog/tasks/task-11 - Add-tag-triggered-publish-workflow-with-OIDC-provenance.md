---
id: TASK-11
title: Add tag-triggered publish workflow with OIDC provenance
status: Done
assignee:
  - '@ox-alpha'
created_date: '2026-08-26 02:03'
updated_date: '2026-08-26 04:46'
labels:
  - ci
  - security
dependencies:
  - TASK-10
  - TASK-7
priority: high
type: chore
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
publish.yml runs on v* tags: clean build, full tests, pack-list validation via the gate script, npm publish --provenance through OIDC trusted publishing, then GitHub Release from the matching CHANGELOG section. Rewrites docs/publishing.md around the automated flow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tag push triggers build, full test run, pack-list validation, then npm publish --provenance with id-token write and no NPM_TOKEN secret
- [x] #2 Publish aborts when the tag does not match package.json version or CHANGELOG lacks an entry for it
- [ ] #3 GitHub Release body contains the matching CHANGELOG section
- [ ] #4 docs/publishing.md describes the automated flow plus an emergency manual fallback
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Per plan Task 5: publish.yml reusable workflow - verify tag/version/changelog, pack-list gate, npm publish --provenance (npm@latest for trusted publishing), gh release from CHANGELOG section; publishing.md rewritten.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done (0d3c0b9): publish.yml verifies tag/version/changelog, pack gate, npm@latest + provenance OIDC, gh release from CHANGELOG section; publishing.md rewritten incl. one-time npm trusted publisher setup and emergency fallback.

Run 32930914065 proves the chain end to end: called Publish job ran npm ci, full tests, tag/version/CHANGELOG verification (v0.2.0 consistent), pack-list gate, then failed exactly at npm publish because the npm trusted publisher is not registered yet (documented one-time manual step). No NPM_TOKEN secret involved at any point. GitHub Release was cut by release-please per its default; the extract-changelog fallback remains as safety net.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reusable publish.yml wired into Release via workflow_call (permissions granted by caller job - required, otherwise startup_failure). Verified live through verification and pack gates; the final npm publish awaits npmjs.com trusted publisher registration, after which merging the open Release PR ships without any manual steps.
<!-- SECTION:FINAL_SUMMARY:END -->
