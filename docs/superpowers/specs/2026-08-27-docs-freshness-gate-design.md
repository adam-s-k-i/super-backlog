# Docs Freshness Gate – Design

Date: 2026-08-27
Status: Approved (design)

## Problem

Releases are fully automated (release-please + publish workflow), and GitHub
Pages redeploys on every push to `master`. What is **not** guaranteed: that
the docs content itself stays current when new user-facing features land.
Today, shipping a feature without docs updates is possible without any
friction. There is also no binding convention for how docs pages are written,
so the site can drift away from "detailed but minimalist and clear from a
user's perspective".

## Goals

1. A hard CI gate: a feature PR (`feat:` title + `src/` changes) must include
   a `docs/` change, unless explicitly exempted.
2. New docs pages follow a binding style convention (Diátaxis types) so the
   GitHub Pages site stays structured, detailed, and user-centric.
3. No new external dependencies; follow the repo's existing pattern of
   locally testable Node scripts (`scripts/verify-release.mjs`,
   `scripts/check-action-pinning.mjs`).

## Non-goals

- No gate for `fix:`, `refactor:`, `perf:`, `chore:` PRs.
- No restructuring of the existing docs information architecture.
- No release-time check (the gate runs PR-side, where the signal is precise).

## Components

### 1. `scripts/check-docs-required.mjs`

Follows the `verify-release.mjs` pattern: an exported pure core function plus
a thin CLI wrapper.

- Core: `checkDocsRequired({ prTitle, labels, changedFiles, sidebarConfig })`
  returns an array of violation strings (empty = pass). Pure and fully unit
  testable without GitHub or git.
- CLI wrapper reads PR title/labels from `$GITHUB_EVENT_PATH` and the changed
  file list via `git diff --name-status origin/master...HEAD`.
- Local manual run supported via flags: `--title`, `--labels`, `--base`.

### 2. Gate rules

- **Trigger:** PR title matches `^feat(\([^)]*\))?!?:` (scope and
  breaking-change `!` allowed) **and** at least one changed file under `src/`.
- **Requirement when triggered:** at least one changed file matching
  `docs/**/*.md`.
- **Exemption:** label `no-docs` on the PR skips the docs-change requirement
  (for features without user-facing surface).
- **Type requirement for new pages:** added files (git status `A`) under
  `docs/**/*.md` must carry frontmatter
  `type: tutorial | how-to | reference | explanation`.
  `docs/superpowers/**` is exempt (specs/plans are internal).
- **Nav requirement:** added docs pages must be linked in
  `docs/.vitepress/config.mts` (sidebar), otherwise they are invisible on
  GitHub Pages.

### 3. Edge cases (decided)

- `feat:` PR touching only `docs/` (no `src/`) → gate does not apply.
- Bot/merge PRs (release-please `chore:`, dependabot) → title does not match
  `feat:` → gate does not apply.
- Renamed/deleted docs pages: nav check only runs for added files; dead
  sidebar links from deletions are already caught by the VitePress build in
  `pages-deploy.yml` (dead-link check is the VitePress default).

### 4. Docs style guide

New "Documentation" section in `CONTRIBUTING.md` (not a separate file):
Diátaxis types with 2–3 guidelines each (user perspective, one page = one
topic, how-tos task-oriented, reference complete). This is the binding
convention the type requirement points to.

### 5. Wiring

New job `Docs-Gate` in `.github/workflows/pr-hygiene.yml` (PR-side, where the
title check already lives). `fetch-depth: 0` for the diff. No new workflow
file, no new dependency.

## Error messages (action-oriented)

- Missing docs on feature: "Feature-PR changes src/ without a docs/ update.
  Either add/update a docs page (see CONTRIBUTING.md → Documentation) or
  apply the `no-docs` label if the feature has no user-facing surface."
- Missing type: "New page docs/guide/x.md needs frontmatter
  `type: tutorial|how-to|reference|explanation`."
- Missing nav entry: "New page docs/guide/x.md is not linked in
  docs/.vitepress/config.mts (sidebar) and would be invisible on GitHub
  Pages."

## Testing

Unit tests (vitest, new `test/check-docs-required.test.ts`):

- `feat:` + `src/` change + no `docs/` change → 1 violation
- `feat:` + `src/` + `docs/` change → pass
- `feat:` + only `docs/` changed → pass
- `feat:` + `src/`, no docs, label `no-docs` → pass
- `fix:` / `chore:` / `docs:` + `src/` change, no docs → pass
- `feat(scope)!:` variants detected as features
- New docs file without `type` frontmatter → violation
- New docs file with invalid type (`type: guide`) → violation
- New docs file, valid type, not in `config.mts` sidebar → violation
- File under `docs/superpowers/` → no type requirement
- Multiple violations at once → all reported

Integration: the implementation PR itself is `feat:` + `src/` + `docs/` and
must pass the new job; evidence in the PR.

## Rollout / backfill

So the gate is consistent from day one, the implementation also adds
`type` frontmatter to the 9 existing pages (`docs/index.md`,
`docs/operations.md`, 7 guide pages).
