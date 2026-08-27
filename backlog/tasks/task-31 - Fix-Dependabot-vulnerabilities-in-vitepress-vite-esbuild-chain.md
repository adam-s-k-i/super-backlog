---
id: TASK-31
title: Fix Dependabot vulnerabilities in vitepress/vite/esbuild chain
status: Done
assignee:
  - '@adam'
created_date: '2026-08-27 13:14'
updated_date: '2026-08-27 13:36'
labels:
  - bug
dependencies: []
type: bug
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
npm audit reports 4 open alerts on the default branch (1 high: vite path traversal/NTLMv2/fs.deny via vitepress's vite 5.4.21; 3 moderate: esbuild GHSA-67mh-4wv8-2f99 + vite). No fix inside the allowed ranges: vitepress 1.6.4 pins vite ^5.4.14 (5.4.21 is the last 5.x and unpatched), vite 5 pins esbuild 0.21. Approach: npm overrides scoped to the vitepress subtree (vite ^6.4.3, esbuild ^0.25.0), then verify the VitePress docs build still works. vitest's own vite 8 subtree must stay untouched.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 npm audit reports 0 vulnerabilities
- [x] #2 VitePress docs build succeeds with the overridden versions
- [x] #3 vitest subtree keeps its own vite version (no downgrade)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add npm overrides scoped to vitepress: vite ^6.4.3, esbuild ^0.25.0. 2. npm install, then npm audit -> expect 0. 3. Verify docs build (npx vitepress build) works with vite 6. 4. Verify vitest still uses vite 8 subtree; full test suite green. 5. Commit + push; Dependabot alerts should close.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nested overrides under vitepress alone were not enough: @vitejs/plugin-vue kept its own vite 5 copy, and the stale lockfile pinned it until a clean reinstall. vitest initially deduped down to vite 6.4.3; a second scoped override keeps it on vite 8. Rebase onto the 0.8.0 release required lockfile regeneration (delete lock + node_modules, npm install).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed all 4 Dependabot alerts via scoped npm overrides: vitepress subtree (incl. @vitejs/plugin-vue) now resolves vite ^6.4.3 + esbuild ^0.25.0, vitest subtree stays on vite 8. Verified: npm audit 0 vulnerabilities, npx vitepress build docs succeeds, full suite 305/305 green, master CI green, GitHub Dependabot API reports 0 open alerts.
<!-- SECTION:FINAL_SUMMARY:END -->
