---
id: TASK-4
title: Prepare npm publish (v0.1.0)
status: Done
assignee: []
created_date: '2026-08-25 23:27'
updated_date: '2026-08-25 23:55'
labels:
  - release
dependencies: []
type: chore
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the package publishable: flip private to false, verify files field packs exactly dist plus README, sanity-check bin names and engines, dry-run pack, document the manual publish step. Actual npm publish happens only on explicit user go.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 package.json no longer private and version stays 0.1.0 for first release
- [x] #2 npm pack dry-run contains only dist assets and README
- [x] #3 sbl and super-backlog bins resolve from the packed tarball layout
- [x] #4 publish checklist added to docs (who, when, how)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence: npm pack --dry-run --json lists exactly LICENSE, README.md, dist/** (29 files incl. templates), package.json. Real tarball extracted to temp: dist/cli.js --version printed 0.1.0 and --help rendered. private flag removed. docs/publishing.md added with who/when/how + checklist. Actual npm publish intentionally NOT executed - explicit user gate.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Package is publish-ready: private flag removed, tarball contents and extracted-bin runtime verified (version + help), publishing checklist documented. Publishing itself awaits explicit user go.
<!-- SECTION:FINAL_SUMMARY:END -->
