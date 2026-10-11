---
id: TASK-118
title: 'Router v2: hardening from review findings'
status: Done
assignee: []
created_date: '2026-10-11 06:48'
updated_date: '2026-10-11 07:38'
labels:
  - bug
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
- [x] #1 A models.json with a leading UTF-8 BOM is read as valid by loadConfig, readConfigStrict and the update migration
- [x] #2 A models.json with a numeric version above 2 is never rewritten: write commands refuse, update warns, readers fall back to defaults
- [x] #3 atomicWrite's rename fallback restores the original target when the second rename fails and leaves no temp files
- [x] #4 cleanLegacy and uninstall recognise the sbl SessionStart hook in single-string command form
- [x] #5 Every invalid-models.json message reads '... left unchanged; fix or delete it'
- [x] #6 sbl models discover (and the dashboard discover endpoint) validate models.json before running opencode models
- [x] #7 sbl models show prints a warning to stderr when models.json is unreadable
- [x] #8 docs/guide/model-router.md says the dashboard enable toggle also installs the agents
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All 8 deferred router v2 review findings fixed test-first on branch fix/router-v2-hardening:

- models.json: a leading UTF-8 BOM is accepted on every read path; a numeric version above 2 is refused (write commands exit 1, readers fall back to defaults, `sbl update` warns and leaves agent files untouched); one invalid-config message everywhere.
- `sbl models discover` and the dashboard discover endpoint validate models.json before running `opencode models`; `sbl models show` warns on stderr for any unreadable file instead of failing.
- atomicWrite fallback restores the original when the retry fails, never moves a directory aside, uses a unique backup name, and names the backup in the error if even the restore fails.
- Legacy SessionStart hook: also recognised in single-string form (interpreter path, quoted parts, `$CLAUDE_PROJECT_DIR`); commands with extra args, another interpreter or shell syntax are kept. The args form now requires node with exactly our script.
- docs/guide/model-router.md: the dashboard toggle installs the agents; BOM, newer-version, show and hook-matching behaviour documented.

Two independent Opus reviews; their findings were addressed except a negligible scoped-package path match (`node_modules/@scope/super-backlog/...`).

Evidence: `npm test` 984 passed / 5 skipped, `npm run lint` 0 issues, `npx vitepress build docs` ok, `tsc --noEmit` clean.
<!-- SECTION:FINAL_SUMMARY:END -->
