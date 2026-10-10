---
id: TASK-107
title: 'Project profile: critical-areas reader and doctor check 6'
status: Done
assignee: []
created_date: '2026-10-10 21:38'
updated_date: '2026-10-10 22:21'
labels:
  - feature
dependencies: []
references:
  - docs/superpowers/plans/2026-10-10-model-tiers-and-project-profile.md
  - docs/superpowers/specs/2026-10-10-model-tiers-and-project-profile-design.md
type: feature
ordinal: 103000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plan Task 2. Add src/lib/critical-areas.ts (CRITICAL_AREAS_PATH, CriticalAreasState, readCriticalAreas that never throws and parses only the Status line) and doctor check 6 behind a deps.readCriticalAreas seam: skip when the file is missing, warn when provisional or without Status line, ok with the stamp, warn when the reader throws. Independent of TASK-106.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 readCriticalAreas returns {status:'missing'} for a missing file, the trimmed Status-line text as stamp, provisional=true when the Status line contains 'provisional' in any case, and present with stamp null for a file without Status line or a directory at the path; it never throws
- [ ] #2 sbl doctor prints the five check-6 lines exactly as the spec table lists them; a missing file is [skip] and leaves the exit code unchanged, a provisional profile exits 4
- [ ] #3 test/unit/critical-areas.test.ts (new) and test/unit/doctor.test.ts cover all states through the seam; test/e2e/doctor.e2e.test.ts tolerates the check-6 skip line
- [ ] #4 npm test and npm run lint are green
<!-- AC:END -->
