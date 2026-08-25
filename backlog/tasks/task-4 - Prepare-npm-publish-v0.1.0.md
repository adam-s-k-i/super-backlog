---
id: TASK-4
title: Prepare npm publish (v0.1.0)
status: To Do
assignee: []
created_date: '2026-08-25 23:27'
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
- [ ] #1 package.json no longer private and version stays 0.1.0 for first release
- [ ] #2 npm pack dry-run contains only dist assets and README
- [ ] #3 sbl and super-backlog bins resolve from the packed tarball layout
- [ ] #4 publish checklist added to docs (who, when, how)
<!-- AC:END -->
