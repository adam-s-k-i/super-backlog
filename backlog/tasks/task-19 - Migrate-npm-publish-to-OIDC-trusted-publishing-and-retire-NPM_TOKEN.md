---
id: TASK-19
title: Migrate npm publish to OIDC trusted publishing and retire NPM_TOKEN
status: To Do
assignee: []
created_date: '2026-08-26 18:59'
labels:
  - ci
  - security
dependencies: []
type: chore
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The v0.3.0 publish failed because super-backlog does not exist on npm yet and no trusted publisher is configured; as a stopgap we publish with a granular NPM_TOKEN secret. Once the package exists on npmjs.com, configure a Trusted Publisher (repo adam-s-k-i/super-backlog, workflow publish.yml), then remove the NODE_AUTH_TOKEN env from publish.yml and delete the NPM_TOKEN secret to return to keyless OIDC publishing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Package super-backlog exists on npm with a Trusted Publisher configured for this repo and publish.yml
- [ ] #2 publish.yml publishes successfully without NODE_AUTH_TOKEN (OIDC only)
- [ ] #3 NPM_TOKEN secret is removed from the repository
- [ ] #4 docs/guide/publishing.md documents the trusted publisher setup
<!-- AC:END -->
