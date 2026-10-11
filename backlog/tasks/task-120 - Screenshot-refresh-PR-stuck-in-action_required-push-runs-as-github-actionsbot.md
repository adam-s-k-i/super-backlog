---
id: TASK-120
title: >-
  Screenshot refresh PR stuck in action_required: push runs as
  github-actions[bot]
status: Done
assignee: []
created_date: '2026-10-11 08:06'
updated_date: '2026-10-11 08:29'
labels:
  - bug
dependencies: []
type: bug
ordinal: 115000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pages-deploy.yml pushes docs/dashboard-screenshot with AUTO_MERGE_TOKEN in the URL, but actions/checkout persists GITHUB_TOKEN as an http.extraheader that takes precedence. The push is attributed to github-actions[bot], so CI and PR hygiene on PR #78 end in action_required and the PR never auto-merges (stuck since 2026-09-24).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Checkout in pages-deploy.yml sets persist-credentials: false so the push authenticates with AUTO_MERGE_TOKEN
- [x] #2 Next screenshot refresh PR gets real CI runs instead of action_required
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
checkout in pages-deploy.yml now sets persist-credentials: false (PR #95), so the screenshot branch is pushed with AUTO_MERGE_TOKEN. Verified: the next refresh of docs/dashboard-screenshot got real CI and PR hygiene runs and PR #78 auto-merged.
<!-- SECTION:FINAL_SUMMARY:END -->
