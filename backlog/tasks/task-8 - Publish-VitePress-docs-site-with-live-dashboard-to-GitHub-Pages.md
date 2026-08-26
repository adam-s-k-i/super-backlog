---
id: TASK-8
title: Publish VitePress docs site with live dashboard to GitHub Pages
status: In Progress
assignee:
  - '@ox-alpha'
created_date: '2026-08-26 02:02'
updated_date: '2026-08-26 03:51'
labels:
  - ci
  - pages
dependencies: []
type: enhancement
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Docs website as the landing page: VitePress config over docs/, existing docs/*.md moved semantically to docs/guide/, freshly generated dashboard.html shipped as static asset, deployed via official deploy-pages flow on every push to master.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 VitePress builds a site with nav and sidebar covering all migrated docs
- [ ] #2 pages-deploy.yml deploys on push to master using environment github-pages, minimal permissions, and a concurrency group
- [ ] #3 Freshly generated dashboard.html is included and reachable on the live site
- [ ] #4 Inbound links (notably README) updated and markdownlint reports no dangling internal links
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Per plan Task 3: move docs/*.md to docs/guide/, fix inbound links, add index.md + .vitepress/config.mts, local vitepress build smoke with fresh dashboard in public/, pages-deploy.yml with pinned SHAs.
<!-- SECTION:PLAN:END -->
