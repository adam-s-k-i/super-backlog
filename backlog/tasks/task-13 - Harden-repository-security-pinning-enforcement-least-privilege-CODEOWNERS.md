---
id: TASK-13
title: 'Harden repository security (pinning enforcement, least privilege, CODEOWNERS)'
status: Done
assignee:
  - '@ox-alpha'
created_date: '2026-08-26 02:03'
updated_date: '2026-08-26 04:12'
labels:
  - ci
  - security
dependencies:
  - TASK-12
priority: medium
type: chore
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cross-cutting security pass over all workflows: least-privilege permissions everywhere, SHA pinning enforced in CI by the checker script, CODEOWNERS ownership, and capture of the manual setup checklist (npm trusted publisher, branch protection, secret scanning).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All workflows declare minimal top-level permissions with per-job elevation only where needed
- [ ] #2 Pinning checker runs as a required CI check on workflow changes and passes
- [ ] #3 CODEOWNERS assigns all paths to the maintainer
- [ ] #4 Setup checklist covers npm trusted publisher registration, master branch protection, secret scanning and push protection, and Pages source
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Per plan Task 7: CODEOWNERS, permissions audit across all workflows, no pull_request_target, best-effort repo security settings via gh api; branch protection applied after final master push.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: CODEOWNERS (* @adam-s-k-i), permissions audit clean (no pull_request_target anywhere; jobs inherit read-only top-level {}), vulnerability-alerts + automated-security-fixes enabled via API, secret_scanning + push_protection confirmed enabled via API response. Branch protection deferred to post-push step by design.
<!-- SECTION:NOTES:END -->
