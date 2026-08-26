---
id: TASK-8
title: Publish VitePress docs site with live dashboard to GitHub Pages
status: Done
assignee: []
created_date: '2026-08-26 02:02'
updated_date: '2026-08-26 20:41'
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
- [x] #1 VitePress builds a site with nav and sidebar covering all migrated docs
- [x] #2 pages-deploy.yml deploys on push to master using environment github-pages, minimal permissions, and a concurrency group
- [x] #3 Freshly generated dashboard.html is included and reachable on the live site
- [x] #4 Inbound links (notably README) updated and markdownlint reports no dangling internal links
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: docs/ VitePress site builds, pages-deploy.yml deploys on push to master with github-pages environment, dashboard.html is generated and shipped as static asset, README links to live docs and npm run lint reports no dangling internal links.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
VitePress docs site with live dashboard published to GitHub Pages; README links updated.
<!-- SECTION:FINAL_SUMMARY:END -->
