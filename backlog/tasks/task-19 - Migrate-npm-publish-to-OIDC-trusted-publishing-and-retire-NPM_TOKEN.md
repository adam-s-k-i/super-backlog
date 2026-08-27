---
id: TASK-19
title: Migrate npm publish to OIDC trusted publishing and retire NPM_TOKEN
status: Done
assignee: []
created_date: '2026-08-26 18:59'
updated_date: '2026-08-27 22:38'
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
- [x] #1 Package super-backlog exists on npm with a Trusted Publisher configured for this repo and publish.yml
- [x] #2 publish.yml publishes successfully without NODE_AUTH_TOKEN (OIDC only)
- [x] #3 NPM_TOKEN secret is removed from the repository
- [x] #4 docs/guide/publishing.md documents the trusted publisher setup
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: npm view super-backlog confirmed package exists and dist.attestations.provenance is present (OIDC already working). Removed NODE_AUTH_TOKEN env from .github/workflows/publish.yml. Deleted NPM_TOKEN repository secret via gh CLI (confirmed via gh secret list). Updated docs/guide/publishing.md with cleanup note and verification command. Build, lint and full test suite (356 passed) verified.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Migrated npm publishing to keyless OIDC: removed NODE_AUTH_TOKEN from publish.yml, deleted the NPM_TOKEN repository secret, and updated docs/guide/publishing.md with cleanup instructions and an OIDC verification command. The package already exists on npm with provenance attestations, confirming trusted publishing is active. Verified with build, lint, and 356 passing tests.
<!-- SECTION:FINAL_SUMMARY:END -->
