---
id: TASK-32
title: 'Dashboard: directory-name fallback for project identity'
status: Done
assignee:
  - '@adam'
created_date: '2026-08-27 15:08'
updated_date: '2026-08-27 15:12'
labels:
  - bug
dependencies: []
type: bug
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
readProjectIdentity in src/dashboard/data.ts falls back to 'Untitled project' when neither backlog config nor package.json provide a name. Add basename(cwd) as the fallback before the generic placeholder so dashboards of projects without package.json show the concrete directory name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dashboard shows basename(cwd) when config and package.json yield no name
- [x] #2 Existing precedence (config project_name, config name, pkg name) is unchanged
- [x] #3 Unit tests cover the new fallback and the unchanged precedence
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
TDD: 1. Failing test in dashboard-data.test.ts: no config, no package.json -> project name is basename(cwd). 2. Add fallback in readProjectIdentity. 3. Precedence tests stay green. 4. Full suite.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
readProjectIdentity now falls back to basename(cwd) before the generic placeholder; precedence config project_name > config name > package.json name unchanged. Verified with 2 new unit tests (22/22 in dashboard-data.test.ts) and a real reproduction: dashboard.html for a package.json-less project titled 'mein-test-projekt' now shows the directory name in title and brand.
<!-- SECTION:FINAL_SUMMARY:END -->
