---
id: TASK-85
title: 'Summary page: YAML subset parser'
status: To Do
assignee: []
created_date: '2026-10-09 21:50'
labels:
  - feature
  - phase/spec
milestone: m-2
dependencies: []
references:
  - docs/superpowers/specs/2026-10-09-project-summary-design.md
type: feature
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Unit 1 of the project summary page spec. Implement parseYamlSubset in src/lib/yamlmini.ts per spec section D7 (no new dependency).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 parseYamlSubset parses block and flow mappings/sequences, quoted and block scalars and comments as defined in D7
- [ ] #2 Every rejected construct (anchors, tags, nested flow collections, etc.) throws an error with line and column
- [ ] #3 CRLF input parses identically to LF; input over 256 KB is rejected
- [ ] #4 test/unit/yamlmini.test.ts covers the above and the existing yamlmini behaviour stays green
<!-- AC:END -->
