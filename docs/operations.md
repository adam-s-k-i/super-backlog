---
type: how-to
---

# Operations guide

This document describes every automation workflow in the repository, its trigger, permissions, cadence, and failure behavior. It also records the one-time setup checklist and links to emergency runbooks.

## Workflow reference

| Workflow | File | Trigger | Permissions | Cadence | Failure behavior |
|---|---|---|---|---|---|
| CI | `ci.yml` | `push` to `master`, `pull_request` | `permissions: {}` | Every push/PR | Blocks merge; required checks are `Lint`, `Guard`, and `Tests`. |
| Release | `release.yml` | `push` to `master` | `contents: write`, `pull-requests: write` | Every push | No release is created; the next push re-runs release-please. |
| Publish | `publish.yml` | `workflow_call` from Release, `workflow_dispatch` | `contents: write`, `id-token: write` | On release tag | Fails the release job; the tag exists but the package/GitHub release may not. |
| PR hygiene | `pr-hygiene.yml` | `pull_request` opened/reopened/synchronize | `contents: read`, `pull-requests: write`, `issues: write` | Every PR update | Non-blocking for human PRs; auto-merge is set only for Dependabot and `autorelease` PRs. |
| Stale | `stale.yml` | `schedule` daily | `issues: write`, `pull-requests: write` | Daily | Logs the failure; stale/close logic runs again the next day. |
| Weekly QA | `qa-weekly.yml` | `schedule` Mondays 04:00 UTC, `workflow_dispatch` | Job-specific | Weekly | Creates/updates an issue labeled `ci-failure` for failing test legs or audit findings. |
| Monthly deep check | `qa-monthly.yml` | `schedule` 1st of month 05:00 UTC, `workflow_dispatch` | Job-specific | Monthly | Opens a `ci-failure` issue for package smoke-test or Pages healthcheck failures. |
| Pages deploy | `pages-deploy.yml` | `push` to `master` | `contents: read`, `pages: write`, `id-token: write` | Every push | Docs site is not updated; the next push retries. |

## CI

- **Lint job**: runs `npm run lint` (markdownlint + cspell) on Ubuntu.
- **Guard job**: runs `node scripts/check-action-pinning.mjs` to enforce SHA-pinned action references.
- **test job**: matrix across `windows-latest` and `ubuntu-latest` with the default Node version, running `npm test`.
- **Tests job**: aggregates the matrix result and is the required status check exposed to branch protection.

## Release

`release.yml` runs release-please on every push to `master`. It maintains exactly one open release PR that bumps `package.json`, updates `CHANGELOG.md`, and is labeled `autorelease: pending`. Merging the release PR creates a `v*` tag, which triggers `publish.yml`.

## Publish

`publish.yml` builds the package, runs the full test suite, validates the pack list, publishes to npm with provenance, and creates a GitHub release from the matching CHANGELOG section. It requires the `NPM_TOKEN` repository secret until TASK-19 (OIDC Trusted Publishing migration) is completed.

## PR hygiene

- **Title-check**: validates Conventional Commits format.
- **Labels**: uses `actions/labeler` to apply path-based labels.
- **Auto-merge**: enables squash auto-merge for Dependabot PRs and release-please PRs only.

## Stale bot

Marks inactive issues and PRs after 30 days, closes them 14 days later. Bug-labeled issues get 60 days before stale and 30 days before close.

## Weekly QA

Runs the full test matrix across `windows-latest` and `ubuntu-latest` on Node 20, 22, and 24. Also runs `npm audit --omit=dev` and opens/updates an issue with findings, and updates the long-lived **Dependency Health** issue via `npm outdated`.

## Monthly deep check

- **Package smoke-test**: packs the tarball, extracts it, runs `dist/bin.js --version` and `--help`, regenerates `dashboard.html`, and asserts the output size.
- **Pages healthcheck**: fetches the live docs site, requires HTTP 200 and the presence of `super-backlog` in the page body, and opens an issue on failure.

## One-time setup checklist

- [ ] Repository created under `adam-s-k-i/super-backlog`.
- [ ] Default branch is `master` and **Allow auto-merge** is enabled in repository settings.
- [ ] Branch protection on `master` requires the `Lint`, `Guard`, and `Tests` status checks.
- [ ] CODEOWNERS file points all paths to `@adam-s-k-i`.
- [ ] Dependabot enabled (`.github/dependabot.yml`) for npm and GitHub Actions.
- [ ] GitHub Pages source set to **GitHub Actions** (`pages-deploy.yml`).
- [ ] npm Trusted Publisher registered for `super-backlog` on npmjs.com.
- [ ] `NPM_TOKEN` secret removed after OIDC publishing is verified (TASK-19).
- [ ] Secret scanning and push protection enabled in repository security settings.

## Dry-run notes

All `workflow_dispatch`-capable workflows were exercised during rollout: `Publish`, `Weekly QA`, and `Monthly deep check` were triggered manually; scheduled workflows were verified by their cron definitions and by inspecting historical runs.
