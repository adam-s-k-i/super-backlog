---
type: how-to
---

# Repository operations

This project runs itself as far as possible. Every automated process is a
GitHub Actions workflow under `.github/workflows/`, and every decision the
workflows make that is worth unit-testing lives in `scripts/` with Vitest
coverage. This document is the operator manual.

## Workflows at a glance

| Workflow | File | Trigger | Permissions | What it does on failure |
| --- | --- | --- | --- | --- |
| CI — Lint | `ci.yml` | PRs, push to master | read-only | blocks merge; fix reported lint/spell issues |
| CI — Guard | `ci.yml` | PRs, push to master | read-only | fails if any action is not SHA-pinned |
| CI — Tests | `ci.yml` | PRs, push to master | read-only | blocks merge; Windows/Ubuntu matrix |
| Release | `release.yml` | push to master | contents/pr write | opens/updates the rolling Release PR |
| Publish | `publish.yml` | called by Release; `workflow_dispatch` | contents write, id-token write | fails fast before publishing when tag/version/CHANGELOG disagree |
| Deploy Pages | `pages-deploy.yml` | push to master; dispatch | pages write, id-token write | previous site stays live; next Monthly deep check reports it |
| Weekly QA | `qa-weekly.yml` | cron Mon 04:00 UTC; dispatch | issues write for report jobs | audit findings / outdated deps posted to their issues |
| Monthly deep check | `qa-monthly.yml` | cron 1st of month 05:00 UTC; dispatch | issues write for healthcheck | opens issue `Pages healthcheck failing` (label `ci-failure`) |
| PR hygiene | `pr-hygiene.yml` | pull_request events | minimal per job | required title check fails the PR; Docs-Gate blocks `feat:` PRs that change `src/` without a docs update |
| Stale | `stale.yml` | cron daily 03:17 UTC; dispatch | issues/prs write | nothing to do |

## The release chain

1. Merge Conventional-Commit PRs (`feat:`, `fix:` ...) into `master`.
   Feature PRs labeled `automerge` merge themselves once checks are green —
   no manual merge click needed.
2. `Release` (release-please) maintains **one** rolling Release PR with the
   version bump and CHANGELOG entry.
3. Green checks → the Release PR merges itself (label `autorelease`) —
   unless the repo variable `RELEASE_AUTOMERGE` is set to `off`, which
   parks the Release PR so several stories can batch into one release.
   Re-enable with `gh variable set RELEASE_AUTOMERGE --body on`, then
   re-arm via a label touch or `gh pr merge <n> --auto --squash`.
4. The merge creates tag `v<x.y.z>`; because `GITHUB_TOKEN` events cannot
   trigger other workflows, `Release` immediately calls the reusable
   `Publish` workflow instead of waiting for a tag event.
5. `Publish` re-verifies everything (`scripts/verify-release.mjs`,
   `scripts/check-pack-list.mjs`), publishes with OIDC provenance
   (no stored npm token), and cuts the GitHub Release from the CHANGELOG.

## Issue automation

- `npm audit findings`: created/updated weekly by `scripts/report-audit.mjs`.
- `Dependency Health`: one long-lived issue updated weekly by
  `scripts/report-health.mjs`.
- `Pages healthcheck failing`: created by the monthly probe, label
  `ci-failure`.
- All reports deduplicate: an existing open issue with the same title gets a
  dated comment instead of spawning new issues
  (`scripts/report-to-issue.mjs`).

## One-time setup checklist

- [x] Dependabot alerts + automated security fixes enabled.
- [x] Secret scanning + push protection enabled.
- [x] Branch protection on `master` (required checks: Lint, Guard, Tests;
      linear history; no force pushes). Deliberately *not* requiring PRs:
      solo maintainer cannot self-review; revisit when collaborators join.
- [ ] Register npm **trusted publisher** for package `super-backlog`
      (npmjs.com → package settings → trusted publisher:
      repo `adam-s-k-i/super-backlog`, workflow `publish.yml`). Until then,
      publish runs fail fast at `npm publish --provenance`.
- [x] GitHub Pages enabled with "GitHub Actions" build source.
- [x] Labels ensured: `ci-failure`, `autorelease`, `dependencies`, `ci`,
      `docs`, `cli`, `tests`, `qa`, `security`, `pages`.

## Dry-run evidence

Recorded during rollout via `workflow_dispatch`; see the checklist comments
in this task's Backlog history for run URLs.

## Local equivalents

```bash
npm test                                  # build + vitest suite
npm run lint                              # markdownlint + cspell
node scripts/check-action-pinning.mjs     # workflow pinning guard
node scripts/check-pr-title.mjs "feat: x" # conventional title guard
npm pack --dry-run --json | node scripts/check-pack-list.mjs
```
