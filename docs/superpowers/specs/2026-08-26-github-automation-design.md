# GitHub Project Automation — Design Spec

- **Date:** 2026-08-26
- **Status:** Draft for review
- **Scope:** Repository operations automation (CI hardening, releases, QA
  schedules, PR hygiene, docs site on GitHub Pages, supply-chain security)

## 1. Problem

Repository operations for `super-backlog` are only partially automated:

- CI runs tests on a Windows/Ubuntu matrix, but nothing enforces the
  documentation styleguide (markdown structure, spelling) or the Conventional
  Commits discipline that future release tooling depends on.
- Publishing is fully manual (`docs/publishing.md`): version bump, CHANGELOG,
  tag, `npm publish`, GitHub Release are separate hand steps.
- There is no scheduled QA; regressions on Node 22, vulnerable or outdated
  dependencies, and a broken published tarball are only found by accident.
- Pull requests have no templates, labels, auto-merge, or staleness handling.
- Nothing is published to GitHub Pages although a generated
  `dashboard.html` exists and the documentation set is growing.
- No systematic protections exist against repository/supply-chain compromise
  (floating action tags, over-privileged tokens, long-lived secrets).

## 2. Goal

One coherent, GitHub-native automation layer where:

- Merging ordinary Conventional-Commit PRs to `master` is the **only** manual
  act needed to ship a release.
- Every push keeps docs style-compliant; every week/month the whole project
  gets a health check without human initiation.
- The public gets a live docs site with an always-fresh project dashboard.
- Compromise surface is minimized by design (pinned actions, least privilege,
  OIDC-only npm publishing, branch protection).

## 3. Decisions (agreed during brainstorming)

| Topic | Decision |
|---|---|
| GitHub Pages | Docs site as the landing page, dashboard integrated |
| Release depth | Fully automated per tag via release-please |
| Docs styleguide | markdownlint + cspell in CI (Conventional Commits + Keep-a-Changelog as conventions); no Vale |
| Regular QA | Weekly full runs + monthly deep check |
| Dependency updates | Dependabot (npm grouped + GitHub Actions) |
| PR handling | Templates, title check, auto-labeling, bot auto-merge, stale management |
| Generator | VitePress |

## 4. Architecture

All workflows live under `.github/workflows/`. Verifiable logic (title regex,
pack-list check, SHA-pinning check, smoke assertions) lives in small Node
scripts under `scripts/` with Vitest tests; workflows only invoke them.

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` (extended) | PRs, push to master | markdownlint, cspell, build, test matrix |
| `release.yml` | push to master | Maintain release-please Release PR |
| `publish.yml` | tag `v*` | Build, test, pack smoke test, npm publish (provenance), GitHub Release |
| `qa-weekly.yml` | cron Mondays ~04:00 UTC | Full OS×Node matrix, `npm audit`, outdated report issue |
| `qa-monthly.yml` | cron 1st of month | Tarball extraction + CLI smoke test, dashboard regeneration check, Pages healthcheck |
| `pages-deploy.yml` | push to master | Build VitePress site incl. fresh dashboard → deploy to GitHub Pages |
| `pr-hygiene.yml` | PR events | Title check, auto-labels, enable auto-merge for bots/release PRs |
| `stale.yml` | cron daily | Mark/close inactive issues and PRs |

Every workflow also gets a `workflow_dispatch` trigger so each can be run
manually once as a dry-run during rollout.

### 4.1 Release pipeline

1. Maintainer merges normal Conventional-Commit PRs (`feat:`, `fix:`, …).
2. `release.yml` (release-please) maintains exactly one open **Release PR**:
   version bump in `package.json` + `CHANGELOG.md` entry (Keep-a-Changelog
   style), labeled `autorelease`.
3. The auto-merge mechanism merges that Release PR automatically once all
   required checks pass.
4. The merge creates tag `v<x.y.z>` → `publish.yml` runs: clean checkout,
   `npm ci && npm test`, `npm pack --dry-run` validated against the package
   file list (`dist/**`, README.md, LICENSE, package.json), then
   `npm publish --provenance` using OIDC trusted publishing
   (`permissions: id-token: write`, no NPM_TOKEN secret), then a GitHub
   Release whose body is the matching CHANGELOG section.
5. `docs/publishing.md` is rewritten to describe the automated flow plus a
   documented emergency-manual fallback.

Guardrails: `publish.yml` aborts if the tag does not match
`package.json` version or if no CHANGELOG entry exists for that version.
release-please is idempotent (one rolling Release PR, never duplicates).

### 4.2 CI & styleguide enforcement

- `ci.yml` keeps its windows-latest/ubuntu-latest matrix and adds:
  - **markdownlint-cli2** across all tracked `*.md`; rules pinned in
    `.markdownlint-cli2.jsonc` (heading hierarchy enforced, line length off,
    trailing whitespace off).
  - **cspell** with a project dictionary (`cspell.json`: backlog, dogfood,
    vitest, …).
  - Existing build + tests unchanged.
- PR title check (`type(scope): subject` per Conventional Commits) is a
  required check — commit messages feed the release versioning.

### 4.3 PR & issue handling

- Templates: `.github/PULL_REQUEST_TEMPLATE.md` (checklist: tests run, docs
  updated, conventional title) and `.github/ISSUE_TEMPLATE/` bug/feature.
- Auto-labeling via `actions/labeler`: `ci` (.github/, scripts), `docs`
  (*.md, docs/), `cli` (src/), `tests` (test/); Dependabot PRs additionally
  get `dependencies`.
- Auto-merge: a workflow enables squash auto-merge only for PRs authored by
  `dependabot[bot]` or labeled `autorelease`; human PRs are never
  auto-merged.
- Stale: daily job marks issues/PRs inactive 30 days (comment + label),
  closes 14 days later; bugs/releases exempt longer (60+30).

### 4.4 Scheduled QA

Weekly (cron):
- Test matrix extended to Node 20 and 22 on both OSes (CI itself stays on
  Node 20; weekly QA catches Node-22 regressions).
- `npm audit --omit=dev` → vulnerability opens an issue with the audit
  excerpt.
- `npm outdated` → one long-lived "Dependency Health" issue updated by
  comment instead of new-issue spam.

Monthly deep check:
- `npm pack`, extract tarball to temp dir, run
  `node dist/cli.js --version` and `--help`.
- Regenerate the dashboard (`super-backlog dashboard`) and assert it was
  produced (non-empty, valid exit code).
- Pages healthcheck: load the live docs URL, require HTTP 200 and a keyword;
  failure opens an issue.

### 4.5 GitHub Pages docs site (VitePress)

```
docs/.vitepress/config.ts   # nav + sidebar
docs/index.md               # landing = condensed README
docs/guide/*.md             # existing docs/*.md move here semantically
public/dashboard.html       # freshly generated at every deploy
```

Moving existing docs updates all inbound links (notably from `README.md`);
link integrity is checked by the markdownlint build so nothing dangles.

`pages-deploy.yml`: generate dashboard → copy into `public/` →
`vitepress build` → official `actions/deploy-pages` flow
(environment `github-pages`, `permissions: pages: write, id-token: write`,
concurrency group so deploys serialize). A failed deploy leaves the previous
site live.

The automation itself must be documented: new `docs/operations.md` describes
every workflow (trigger, permissions, cadence) plus the one-time setup
checklist below. All new docs pass the same markdownlint/cspell gate.

### 4.6 Supply-chain security

1. All third-party actions pinned by **commit SHA**, never floating tags;
   a repo script verifies pinning for all workflows.
2. Least privilege: top-level `permissions: {}` (read-only default);
   `contents: write` only in the release/auto-merge job, `id-token: write`
   only in publish/pages jobs.
3. No long-lived secrets: npm publishing uses OIDC trusted publishing;
   no `NPM_TOKEN`, no PATs.
4. Branch protection on `master`: PRs required, required checks (lint,
   build/test, title), no force pushes, linear history.
5. `CODEOWNERS`: maintainer owns all paths.
6. Secret scanning + push protection enabled.
7. Dependabot updates GitHub Actions versions too (SHA bumps via bot PR).
8. Context separation: publish never runs in PR context;
   `pull_request_target` is not used anywhere.

## 5. Failure handling

- Any workflow failure (cron or release) opens an issue, deduplicated under
  a single `ci-failure` label via comment-on-existing rather than new-issue
  spam; publish failures always alert immediately.
- Monthly pages healthcheck reports a broken site even if the workflow
  failure alert was missed.

## 6. Testing strategy

- Unit-testable pieces (title regex matcher, pack-list validator, SHA-pinning
  checker, smoke assertions) implemented as scripts with Vitest tests — CI
  tests the gates themselves.
- Each workflow ships with `workflow_dispatch` and is dry-run manually during
  rollout following a documented checklist; no further YAML-lint tooling.

## 7. One-time setup checklist (manual, documented in docs/operations.md)

1. Register npm trusted publisher for `super-backlog` (package name ↔ repo ↔
   publish workflow).
2. Enable branch protection on `master` with the required checks above.
3. Enable secret scanning + push protection.
4. Enable GitHub Pages with source "GitHub Actions".
5. Install/first-run release-please so the initial Release PR appears.
6. Verify all workflows once via `workflow_dispatch`.

## 8. Non-goals

- Prose-quality linting (Vale) — rejected for maintenance cost.
- Renovate — Dependabot chosen.
- Multi-package monorepo releasing — single npm package only.
- semantic-release-style instant publishing on merge — release PR phase kept
  deliberately as the visible checkpoint.
