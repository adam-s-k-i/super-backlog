---
id: TASK-93
title: 'Summary YAML subset: close parser leniencies and test gaps'
status: To Do
assignee: []
created_date: '2026-10-10 10:28'
labels:
  - bug
  - phase/spec
dependencies: []
references:
  - docs/superpowers/specs/2026-10-09-project-summary-design.md
  - src/lib/yamlmini.ts
type: bug
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the project-summary final review (v1.7.0). src/lib/yamlmini.ts accepts several inputs outside the documented YAML subset instead of rejecting them with a line-numbered error, and a few parser paths have no tests. The guide's YAML-subset section does not yet describe the reserved-key rejection and the nesting depth limit that the v1.7.0 fix wave added.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each of these inputs is either rejected with a line-numbered parse error or explicitly documented as accepted: '-0' as a number, 'a: x:', 'a: - x', '[a]#x' (comment without a preceding space), trailing spaces inside literal blocks being stripped, and '{ k: }' (empty value in a flow mapping)
- [ ] #2 New unit tests cover: trailing garbage after a flow collection, a '- |' literal block as a sequence item, quoted mapping keys, and text after a closing quoted scalar
- [ ] #3 The 256 KB size-limit test no longer asserts a 1000 ms wall-clock bound that can flake on a loaded CI runner (assert linear behaviour or use a generous bound instead)
- [ ] #4 docs/guide/project-summary.md (YAML subset section) names the rejected reserved keys (__proto__, constructor, prototype) and the nesting depth limit of 32
- [ ] #5 npm test and npm run lint pass
<!-- AC:END -->
