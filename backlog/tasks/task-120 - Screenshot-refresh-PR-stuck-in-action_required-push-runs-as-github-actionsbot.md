---
id: TASK-120
title: >-
  Screenshot refresh PR stuck in action_required: push runs as
  github-actions[bot]
status: In Progress
assignee: []
created_date: '2026-10-11 08:06'
updated_date: '2026-10-11 08:24'
labels:
  - bug
  - phase/verify
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
- [ ] #2 Next screenshot refresh PR gets real CI runs instead of action_required
<!-- AC:END -->
