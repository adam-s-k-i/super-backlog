---
id: TASK-21
title: Add robust cross-platform installer scripts
status: Done
assignee:
  - '@opencode'
created_date: '2026-08-27 10:33'
updated_date: '2026-08-27 11:04'
labels: []
dependencies: []
modified_files:
  - docs/guide/quickstart.md
  - docs/index.md
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide official installation paths for super-backlog that do not rely on npx super-backlog init, because Windows PowerShell users frequently hit ExecutionPolicy errors when running npx scripts. The goal is a friction-free install on Windows, macOS, and Linux regardless of shell settings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Windows install.ps1 can be invoked via irm-url-iex without triggering ExecutionPolicy errors
- [x] #2 macOS and Linux install.sh can be invoked via curl-url-bash
- [x] #3 Node-based fallback path is documented for users who already have Node and npm
- [x] #4 README installation instructions recommend the new installers instead of npx
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add scripts/install.ps1 for Windows that checks Node/npm, installs super-backlog globally or locally, and runs the CLI directly without npx. 2. Add scripts/install.sh for macOS/Linux with the same behavior. 3. Add docs for the Node-based fallback path. 4. Update README.md installation section to recommend the new installers and remove the npx-first recommendation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created scripts/install.ps1 and scripts/install.sh. Updated README Quickstart section. Syntax-checked PowerShell and Bash scripts. sbl doctor confirms environment.

Updated docs/guide/quickstart.md and docs/index.md with new installer instructions so GitHub Pages will reflect changes after next deploy.

Verification: PowerShell syntax OK (Get-Command -Syntax), Bash syntax OK (bash -n), npm lint passed, npm test passed (256 tests), VitePress docs build passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added scripts/install.ps1 and scripts/install.sh to super-backlog. Updated README.md, docs/guide/quickstart.md, and docs/index.md to recommend the new installers and document the Node fallback. Adjusted markdownlint config to allow <code> in docs/index.md. Verified with lint, full test suite, and VitePress build.
<!-- SECTION:FINAL_SUMMARY:END -->
