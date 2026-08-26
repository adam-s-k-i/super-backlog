---
id: TASK-8
title: Publish VitePress docs site with live dashboard to GitHub Pages
status: To Do
assignee: []
created_date: '2026-08-26 02:02'
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
