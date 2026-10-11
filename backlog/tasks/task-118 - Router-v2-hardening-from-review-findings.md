---
id: TASK-118
title: 'Router v2: hardening from review findings'
status: In Progress
assignee: []
created_date: '2026-10-11 06:48'
updated_date: '2026-10-11 06:48'
labels:
  - bug
  - phase/impl
dependencies: []
references:
  - docs/superpowers/plans/2026-10-11-router-v2-hardening.md
type: bug
ordinal: 114000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred minor findings from the router v2 reviews (PR #88): BOM and version handling in models.json, atomicWrite fallback, string-form legacy hook, consistent error messages, discover/show behavior with an invalid config, dashboard docs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A models.json with a leading UTF-8 BOM is read as valid by loadConfig, readConfigStrict and the update migration
- [ ] #2 A models.json with a numeric version above 2 is never rewritten: write commands refuse, update warns, readers fall back to defaults
- [ ] #3 atomicWrite's rename fallback restores the original target when the second rename fails and leaves no temp files
- [ ] #4 cleanLegacy and uninstall recognise the sbl SessionStart hook in single-string command form
- [ ] #5 Every invalid-models.json message reads '... left unchanged; fix or delete it'
- [ ] #6 sbl models discover (and the dashboard discover endpoint) validate models.json before running opencode models
- [ ] #7 sbl models show prints a warning to stderr when models.json is unreadable
- [ ] #8 docs/guide/model-router.md says the dashboard enable toggle also installs the agents
<!-- AC:END -->
