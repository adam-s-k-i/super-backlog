# GitHub Project Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully automated repository operations for `super-backlog`: styleguide-gated CI, release-please release pipeline with OIDC npm publishing, scheduled QA, PR hygiene, VitePress docs site on GitHub Pages, and supply-chain hardening.

**Architecture:** All automation lives in `.github/workflows/*.yml` calling small tested Node gate scripts under `scripts/`. Publishing is a reusable workflow invoked by the release workflow when release-please reports a new tag (avoids the GITHUB_TOKEN-does-not-trigger-workflows limitation while keeping tag semantics; guarded by a verify script).

**Tech Stack:** GitHub Actions, markdownlint-cli2, cspell, VitePress, release-please-action, Vitest (existing), plain Node ESM scripts.

**Spec:** `docs/superpowers/specs/2026-08-26-github-automation-design.md`

## Global Constraints

- Node >= 20; package is ESM (`"type": "module"`); tests are Vitest in `test/**/*.test.ts`.
- Every third-party GitHub Action referenced by commit SHA (40-hex), never a floating tag. Resolve at execution time: `git ls-remote https://github.com/<owner>/<repo> <tag>` and use the printed SHA.
- Least privilege: top-level `permissions: {}` in every workflow; per-job elevation only where needed.
- No long-lived secrets: no NPM_TOKEN, no PATs. npm publish uses OIDC provenance; issue/report steps use `${{ github.token }}` via `gh`.
- Conventional Commits everywhere (PR titles checked by gate script).
- Work on branch `feat/github-automation`; one commit series per backlog task; merge to master after full verification.
- Backlog task status changes only via `backlog` CLI with verification evidence.

---

### Task 1 (backlog TASK-6): Styleguide gate — markdownlint-cli2 + cspell

**Files:**
- Create: `.markdownlint-cli2.jsonc`, `cspell.json`
- Modify: `package.json` (scripts + devDeps), `.github/workflows/ci.yml`, `README.md`, any doc files that fail lint

**Interfaces:**
- Produces: npm script `lint` (used later by CI job "Lint"); clean-baseline docs.

- [ ] **Step 1: Install devDependencies**

```bash
npm install -D markdownlint-cli2 cspell vitepress
```

(vitepress installed now so Task 3 needs no second install round.)

- [ ] **Step 2: Create `.markdownlint-cli2.jsonc`**

```jsonc
{
  "config": {
    "MD013": false,
    "MD024": { "siblings_only": true },
    "MD033": { "allowed_elements": ["details", "summary", "br"] },
    "MD041": false,
    "line-length": false
  },
  "globs": ["**/*.md"],
  "ignores": ["**/node_modules/**", "**/dist/**", "**/backlog/**", "**/docs/superpowers/plans/**"]
}
```

- [ ] **Step 3: Create `cspell.json`**

```json
{
  "version": "0.2",
  "language": "en",
  "dictionaries": ["node", "typescript"],
  "words": [
    "backlog", "super-backlog", "vitest", "dependabot", "markdownlint",
    "markdownlint-cli2", "cspell", "dogfood", "dogfooding", "harness",
    "opencode", "OpenCode", "CODEOWNERS", "vitepress", "VitePress",
    "npmjs", "provenance", "release-please", "workflow_dispatch",
    "adam-s-k-i", "kanban", "idempotent", "idempotent", "squash",
    "tarball", "untracked", "walkthrough"
  ],
  "ignorePaths": [
    "node_modules/**", "dist/**", "backlog/**", "coverage/**",
    "package-lock.json", "docs/assets/**", "docs/superpowers/plans/**"
  ]
}
```

- [ ] **Step 4: Add npm scripts to `package.json`**

```json
"lint": "markdownlint-cli2 \"**/*.md\" && cspell --no-progress --no-summary \"**/*.md\""
```

- [ ] **Step 5: Run and fix violations**

Run: `npm run lint` — fix every reported violation in tracked docs until exit 0 (no rule exclusions beyond the config above).

- [ ] **Step 6: Extend `.github/workflows/ci.yml` with `Lint` job**

```yaml
jobs:
  Lint:
    runs-on: ubuntu-latest
    permissions: {}
    steps:
      - uses: actions/checkout@PIN_CHECKOUT
      - uses: actions/setup-node@PIN_SETUP_NODE
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
```

(Existing `test` matrix job stays; top-level `permissions: {}` added.)

- [ ] **Step 7: Document local usage in README (Development section)**

Add under a new `### Development` heading:

```markdown
### Development

```bash
npm ci          # install dependencies
npm test        # build + vitest suite
npm run lint    # markdownlint + cspell over all Markdown
```
```

- [ ] **Step 8: Verify & commit**

Run: `npm run lint && npm test` → both green. Commit `ci: add styleguide gate (markdownlint-cli2 + cspell) (TASK-6)`.

---

### Task 2 (backlog TASK-7): Gate scripts with Vitest tests

**Files:**
- Create: `scripts/check-pr-title.mjs`, `scripts/check-pack-list.mjs`, `scripts/check-action-pinning.mjs`, `scripts/verify-release.mjs`, `scripts/extract-changelog.mjs`
- Test: `test/unit/check-pr-title.test.ts`, `test/unit/check-pack-list.test.ts`, `test/unit/check-action-pinning.test.ts`, `test/unit/verify-release.test.ts`, `test/unit/extract-changelog.test.ts`

**Interfaces:**
- Produces (imported by workflows as CLI, by tests as functions):
  - `isValidTitle(t: string): boolean`
  - `findUnexpectedFiles(entries: {path: string}[], allowed: string[]): string[]`
  - `findUnpinnedActions(yamlText: string): {action: string; ref: string}[]`
  - `verifyRelease({version, changelogText, remoteTagExists}: …): string[]` (list of problems)
  - `extractChangelogSection(changelogText: string, version: string): string | null`

- [ ] **Step 1: Failing tests for title checker**

```ts
import { describe, expect, it } from 'vitest';
import { isValidTitle } from '../../scripts/check-pr-title.mjs';

describe('isValidTitle', () => {
  it('accepts conventional titles', () => {
    expect(isValidTitle('feat: add search')).toBe(true);
    expect(isValidTitle('fix(cli): exit 1 on bad JSON')).toBe(true);
    expect(isValidTitle('chore(deps): bump vite from 5 to 6')).toBe(true);
    expect(isValidTitle('feat!: breaking change')).toBe(true);
  });
  it('rejects non-conventional titles', () => {
    expect(isValidTitle('Update stuff')).toBe(false);
    expect(isValidTitle('feature: wrong type')).toBe(false);
    expect(isValidTitle('feat:no space')).toBe(false);
    expect(isValidTitle('')).toBe(false);
    expect(isValidTitle('feat: ')).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify failure** — `npx vitest run test/unit/check-pr-title.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `scripts/check-pr-title.mjs`**

```js
#!/usr/bin/env node
const PATTERN = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w./-]+\))?!?: \S.+/;

export function isValidTitle(title) {
  return PATTERN.test(title);
}

if (import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href ||
    process.argv[1]?.endsWith('check-pr-title.mjs')) {
  const title = process.argv[2] ?? process.env.PR_TITLE ?? '';
  if (!isValidTitle(title)) {
    console.error(`Invalid PR title: "${title}"`);
    console.error('Expected Conventional Commits format: type(scope)?: subject');
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run again → PASS. Commit not yet (batch commits per script group allowed: commit after all five scripts green).**

- [ ] **Steps 5–8: pack-list checker (TDD cycle)**

Test:

```ts
import { describe, expect, it } from 'vitest';
import { findUnexpectedFiles } from '../../scripts/check-pack-list.mjs';

describe('findUnexpectedFiles', () => {
  const allowed = ['README.md', 'LICENSE', 'package.json', 'dist/**'];
  it('accepts dist files and root metadata', () => {
    const entries = [{ path: 'package.json' }, { path: 'README.md' }, { path: 'LICENSE' }, { path: 'dist/cli.js' }, { path: 'dist/lib/x.js' }];
    expect(findUnexpectedFiles(entries, allowed)).toEqual([]);
  });
  it('flags stray files', () => {
    const entries = [{ path: 'src/cli.ts' }, { path: 'dashboard.html' }];
    expect(findUnexpectedFiles(entries, allowed)).toEqual(['src/cli.ts', 'dashboard.html']);
  });
});
```

Implementation `scripts/check-pack-list.mjs`:

```js
#!/usr/bin/env node
export function findUnexpectedFiles(entries, allowed) {
  const roots = allowed.filter((a) => !a.endsWith('/**'));
  const prefixes = allowed.filter((a) => a.endsWith('/**')).map((p) => p.slice(0, -2));
  return entries.map((e) => e.path).filter((p) =>
    !roots.includes(p) && !prefixes.some((pre) => p.startsWith(pre)));
}

if (process.argv[1]?.endsWith('check-pack-list.mjs')) {
  let raw = '';
  process.stdin.on('data', (d) => (raw += d));
  process.stdin.on('end', () => {
    const packs = JSON.parse(raw);
    const entries = packs.flatMap((p) => p.files ?? []);
    const unexpected = findUnexpectedFiles(entries, ['README.md', 'LICENSE', 'package.json', 'dist/**']);
    if (unexpected.length) {
      console.error('Pack contains unexpected files:');
      for (const f of unexpected) console.error(`  - ${f}`);
      process.exit(1);
    }
  });
}
```

Usage in workflows: `npm pack --dry-run --json | node scripts/check-pack-list.mjs`.

- [ ] **Steps 9–12: pinning checker (TDD cycle)**

Test:

```ts
import { describe, expect, it } from 'vitest';
import { findUnpinnedActions } from '../../scripts/check-action-pinning.mjs';

describe('findUnpinnedActions', () => {
  it('accepts SHA-pinned and local actions', () => {
    const y = [
      '- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2',
      '- uses: ./scripts/local',
    ].join('\n');
    expect(findUnpinnedActions(y)).toEqual([]);
  });
  it('flags tags and branch refs', () => {
    const y = ['- uses: actions/checkout@v4', '- uses: actions/setup-node@main'];
    const bad = findUnpinnedActions(y);
    expect(bad.map((b) => b.action)).toEqual(['actions/checkout', 'actions/setup-node']);
  });
});
```

Implementation `scripts/check-action-pinning.mjs`:

```js
#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const USES = /^\s*(?:uses|-\s*uses):\s*(\S+)@(\S+)/;
const SHA = /^[0-9a-f]{40}$/;

export function findUnpinnedActions(text) {
  return text.split(/\r?\n/).flatMap((line) => {
    const m = line.match(USES);
    if (!m) return [];
    const [, action, ref] = m;
    if (action.startsWith('./') || SHA.test(ref)) return [];
    return [{ action, ref }];
  });
}

if (process.argv[1]?.endsWith('check-action-pinning.mjs')) {
  const dir = '.github/workflows';
  const offenders = readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .flatMap((f) => findUnpinnedActions(readFileSync(join(dir, f), 'utf8')).map((o) => ({ ...o, file: f })));
  if (offenders.length) {
    for (const o of offenders) console.error(`${o.file}: ${o.action}@${o.ref} must be pinned to a full commit SHA`);
    process.exit(1);
  }
}
```

- [ ] **Steps 13–16: release verifier (TDD cycle)**

Test:

```ts
import { describe, expect, it } from 'vitest';
import { extractChangelogSection, verifyRelease } from '../../scripts/verify-release.mjs';

const CL = `# Changelog\n\n## [0.2.0] - 2026-09-01\n\n### Added\n\n- x\n\n## [0.1.0] - 2026-08-26\n\n### Added\n\n- y\n`;

describe('verifyRelease', () => {
  it('passes when version matches changelog entry', () => {
    expect(verifyRelease({ version: '0.2.0', changelogText: CL, remoteTagExists: true })).toEqual([]);
  });
  it('fails on missing changelog entry or missing remote tag', () => {
    expect(verifyRelease({ version: '0.3.0', changelogText: CL, remoteTagExists: true }).length).toBe(1);
    expect(verifyRelease({ version: '0.2.0', changelogText: CL, remoteTagExists: false }).length).toBe(1);
  });
});

describe('extractChangelogSection', () => {
  it('returns the section body for the requested version', () => {
    expect(extractChangelogSection(CL, '0.1.0')).toContain('- y');
    expect(extractChangelogSection(CL, '0.1.0')).not.toContain('- x');
  });
  it('returns null when absent', () => {
    expect(extractChangelogSection(CL, '9.9.9')).toBeNull();
  });
});
```

Implementation `scripts/verify-release.mjs`:

```js
#!/usr/bin/env node
import { readFileSync } from 'node:fs';

export function verifyRelease({ version, changelogText, remoteTagExists }) {
  const problems = [];
  const header = new RegExp(`^## \\\\[[v]?${version.replace(/\./g, '\\\\.')}\\\\]`, 'm');
  if (!header.test(changelogText)) problems.push(`CHANGELOG.md has no entry for ${version}`);
  if (!remoteTagExists) problems.push(`remote tag v${version} does not exist`);
  return problems;
}

export function extractChangelogSection(text, version) {
  const lines = text.split(/\\r?\\n/);
  const startIdx = lines.findIndex((l) =>
    new RegExp(`^## \\\\[[v]?${version.replace(/\\./g, '\\\\.')}\\\\]`).test(l));
  if (startIdx === -1) return null;
  const endIdx = lines.findIndex((l, i) => i > startIdx && /^## \\[/.test(l));
  return lines.slice(startIdx + 1, endIdx === -1 ? lines.length : endIdx).join('\\n').trim();
}

if (process.argv[1]?.endsWith('verify-release.mjs')) {
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const cl = readFileSync('CHANGELOG.md', 'utf8');
  const tagRef = process.argv[2] ?? `v${version}`;
  import('node:child_process').then(({ execFileSync }) => {
    let exists = false;
    try {
      const out = execFileSync('git', ['ls-remote', 'origin', `refs/tags/${tagRef}`], { encoding: 'utf8' });
      exists = out.trim().length > 0;
    } catch { exists = false; }
    const problems = verifyRelease({ version, changelogText: cl, remoteTagExists: exists });
    if (problems.length) { for (const p of problems) console.error(p); process.exit(1); }
  });
}
```

- [ ] **Steps 17–20: changelog extractor CLI wrapper (TDD via verify-release tests above)**

`scripts/extract-changelog.mjs`:

```js
#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { extractChangelogSection } from './verify-release.mjs';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const section = extractChangelogSection(readFileSync('CHANGELOG.md', 'utf8'), version);
if (!section) { console.error(`No CHANGELOG section for ${version}`); process.exit(1); }
if (process.argv[2]) writeFileSync(process.argv[2], section);
else process.stdout.write(section);
```

- [ ] **Step 21: Full unit suite green + wire `Guard` job into CI**

```yaml
  Guard:
    runs-on: ubuntu-latest
    permissions: {}
    steps:
      - uses: actions/checkout@PIN_CHECKOUT
      - run: node scripts/check-action-pinning.mjs
```

Commit `feat(scripts): tested automation gates (title, pack list, SHA pinning, release verify) (TASK-7)`.

---

### Task 3 (backlog TASK-8): VitePress docs site + Pages deploy

**Files:**
- Create: `docs/index.md`, `docs/.vitepress/config.mts`, `.github/workflows/pages-deploy.yml`
- Move: `docs/{architecture,guard,harness-support,publishing,troubleshooting}.md` → `docs/guide/`
- Modify: `README.md` (docs link), inbound links found via grep

**Interfaces:**
- Consumes: `npm run lint` (Task 1), dashboard CLI `node dist/cli.js dashboard --no-open --out <file>` (existing).
- Produces: live site URL `https://adam-s-k-i.github.io/super-backlog/` incl. `/dashboard.html`; workflow named `Deploy Pages` (job `build` + `deploy`).

- [ ] **Step 1: Move docs**

```bash
git mv docs/architecture.md docs/guide/architecture.md   # repeat for guard, harness-support, publishing, troubleshooting
```

- [ ] **Step 2: Fix inbound links** — `grep -rn "docs/(architecture|guard|harness-support|publishing|troubleshooting)" README.md CONTRIBUTING.md docs/ .github/ src/ test/` → rewrite each hit to `docs/guide/<name>.md` (or site URL for user-facing README links).

- [ ] **Step 3: `docs/index.md`**

```markdown
---
layout: home

hero:
  name: super-backlog
  text: Backlog.md + Superpowers, one command
  tagline: Install, maintain, and visualize a structured agent workflow in any project.
  actions:
    - theme: brand
      text: Get started
      link: /guide/architecture
    - theme: alt
      text: Project Dashboard
      link: /dashboard.html

features:
  - title: One-command install
    details: npx super-backlog init wires Backlog.md, Superpowers skills, npm scripts, and the dashboard into your project.
  - title: Clean uninstall
    details: Ownership-proven removal keeps your task data unless you ask otherwise.
  - title: Live project dashboard
    details: A single self-contained HTML file generated from your Backlog data.
---
```

- [ ] **Step 4: `docs/.vitepress/config.mts`**

```ts
import { defineConfig } from 'vitepress';

export default defineConfig({
  srcExclude: ['**/superpowers/**'],
  description: 'One command to equip any project with Backlog.md + Superpowers',
  themeConfig: {
    siteTitle: 'super-backlog',
    nav: [
      { text: 'Guide', link: '/guide/architecture' },
      { text: 'Dashboard', link: '/dashboard.html' },
      { text: 'GitHub', link: 'https://github.com/adam-s-k-i/super-backlog' }
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Architecture', link: '/guide/architecture' },
          { text: 'Harness support', link: '/guide/harness-support' },
          { text: 'Guard hook', link: '/guide/guard' },
          { text: 'Publishing', link: '/guide/publishing' },
          { text: 'Troubleshooting', link: '/guide/troubleshooting' }
        ]
      }
    ]
  }
});
```

- [ ] **Step 5: Local build smoke** — `npm run build && node dist/cli.js dashboard --no-open --out docs/public/dashboard.html && npx vitepress build docs` → dist produced without errors.

- [ ] **Step 6: `.github/workflows/pages-deploy.yml`**

```yaml
name: Deploy Pages
on:
  push:
    branches: [master]
  workflow_dispatch:

permissions: {}
concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    permissions: {contents: read}
    steps:
      - uses: actions/checkout@PIN_CHECKOUT
      - uses: actions/setup-node@PIN_SETUP_NODE
        with: {node-version: 20, cache: npm}
      - run: npm ci
      - run: npm run build
      - run: node dist/cli.js dashboard --no-open --out docs/public/dashboard.html
      - run: npx vitepress build docs
      - uses: actions/upload-pages-artifact@PIN_UPLOAD_PAGES
        with: {path: docs/.vitepress/dist}
  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions: {pages: write, id-token: write}
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@PIN_DEPLOY_PAGES
```

- [ ] **Step 7: README badge/link block** under the CI badge:

```markdown
[![Docs](https://img.shields.io/badge/docs-adam--s--k--i.github.io%2Fsuper--backlog-blue)](https://adam-s-k-i.github.io/super-backlog/)
```

- [ ] **Step 8: Verify & commit** — `npm run lint && npm test` green; `git mv` staged cleanly. Commit `feat(docs): VitePress docs site with live dashboard deploy (TASK-8)`.

---

### Task 4 (backlog TASK-9): PR/issue hygiene + Dependabot

**Files:**
- Create: `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/{bug.yml,feature.yml,config.yml}`, `.github/labeler.yml`, `.github/dependabot.yml`, `.github/workflows/pr-hygiene.yml`, `.github/workflows/stale.yml`

**Interfaces:**
- Consumes: `scripts/check-pr-title.mjs` (Task 2).
- Produces: labels `autorelease`, `dependencies`, `ci`, `docs`, `cli`, `tests` used by Task 5 auto-merge logic.

- [ ] **Step 1: Templates**

`.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## What

<!-- Describe the change. -->

## Why

<!-- Link the Backlog task or issue. -->

## Checklist

- [ ] Title follows Conventional Commits (type(scope)?: subject)
- [ ] `npm test` passes locally
- [ ] Docs updated when behavior changed
```

`.github/ISSUE_TEMPLATE/bug.yml` / `feature.yml` / `config.yml`: standard YAML forms (bug: description/steps/expected/actual/environment checkboxes; feature: problem/proposal/alternatives; config blank_issues_enabled: false).

- [ ] **Step 2: `.github/labeler.yml`** (labeler v5 syntax)

```yaml
ci:
  - changed-files:
      - any-glob-to-any-file: ['.github/**', 'scripts/**']
docs:
  - changed-files:
      - any-glob-to-any-file: ['**/*.md', 'docs/**']
cli:
  - changed-files:
      - any-glob-to-any-file: 'src/**'
tests:
  - changed-files:
      - any-glob-to-any-file: 'test/**'
```

- [ ] **Step 3: `.github/dependabot.yml`**

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    groups:
      dev-dependencies:
        dependency-type: development
    commit-message:
      prefix: chore
      include: scope
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    commit-message:
      prefix: chore
      include: scope
```

- [ ] **Step 4: `.github/workflows/pr-hygiene.yml`**

```yaml
name: PR hygiene
on:
  pull_request:
    types: [opened, reopened, synchronize]

permissions: {}

jobs:
  Title-check:
    runs-on: ubuntu-latest
    permissions: {}
    steps:
      - uses: actions/checkout@PIN_CHECKOUT
      - run: node scripts/check-pr-title.mjs "${{ github.event.pull_request.title }}"

  Labels:
    runs-on: ubuntu-latest
    permissions: {contents: read, pull-requests: write, issues: write}
    steps:
      - uses: actions/labeler@PIN_LABELER
        with: {sync-labels: true}

  Auto-merge:
    runs-on: ubuntu-latest
    permissions: {contents: write, pull-requests: write}
    if: >-
      github.actor == 'dependabot[bot]' ||
      contains(github.event.pull_request.labels.*.name, 'autorelease')
    steps:
      - env: {GH_TOKEN: "${{ github.token }}", GH_REPO: "${{ github.repository }}"}
        run: gh pr merge --auto --squash "${{ github.event.pull_request.number }}"
```

(Dependabot gets `dependencies` label automatically — Dependabot sets it itself.)

- [ ] **Step 5: `.github/workflows/stale.yml`**

```yaml
name: Stale
on:
  schedule:
    - cron: "17 3 * * *"
  workflow_dispatch:

permissions: {}

jobs:
  Mark-and-close:
    runs-on: ubuntu-latest
    permissions: {issues: write, pull-requests: write}
    steps:
      - uses: actions/stale@PIN_STALE
        with:
          days-before-stale: 30
          days-before-close: 14
          exempt-issue-labels: bug,pinned,security
          exempt-pr-labels: pinned,security
          stale-label: stale
          stale-issue-message: "This has been inactive for 30 days and will be closed in 14 days."
          stale-pr-message: "This PR has been inactive for 30 days and will be closed in 14 days."
  Bug-cleanup:
    runs-on: ubuntu-latest
    permissions: {issues: write}
    # Anything surviving the 30/14 sweep that is still open past these thresholds is a bug-labeled issue.
    steps:
      - uses: actions/stale@PIN_STALE
        with:
          days-before-stale: 60
          days-before-close: 30
          any-of-labels: bug
          stale-label: stale
          stale-issue-message: "This bug report has been inactive for 60 days and will be closed in 30 days."
```

- [ ] **Step 6: Verify & commit** — `node scripts/check-action-pinning.mjs` green; YAML parses (`npx yaml` not needed — Guard job validates pinning; parse sanity via node `js-yaml` optional skip). Commit `ci: PR hygiene, stale management, dependabot config (TASK-9)`.

---

### Task 5 (backlog TASK-10 + TASK-11): Release pipeline + publish

**Files:**
- Create: `.github/release-please-config.json`, `.release-please-manifest.json`, `.github/workflows/release.yml`, `.github/workflows/publish.yml`
- Modify: `docs/guide/publishing.md` (rewritten)

**Interfaces:**
- Consumes: Tasks 2/4 (gate scripts, `autorelease` auto-merge).
- Produces: automatic `v*` tags; reusable `publish.yml` with `workflow_call` + `workflow_dispatch`.

Design note (deviation from spec table, documented): release-please creates the tag with GITHUB_TOKEN, and GITHUB_TOKEN events do not trigger other workflows. Therefore `publish.yml` is `workflow_call`+`workflow_dispatch` and `release.yml` invokes it immediately when release-please outputs `releases_created=true` — semantically identical (publish runs exactly when the tag is born), immune to the token limitation, and the verify script still enforces tag↔version↔CHANGELOG consistency.

- [ ] **Step 1: `.github/release-please-config.json`**

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "node",
      "include-component-in-tag": false,
      "extra-files": []
    }
  }
}
```

- [ ] **Step 2: `.release-please-manifest.json`**

```json
{".": "0.1.0"}
```

- [ ] **Step 3: `.github/workflows/release.yml`**

```yaml
name: Release
on:
  push:
    branches: [master]

permissions: {}

jobs:
  Release-please:
    runs-on: ubuntu-latest
    permissions: {contents: write, pull-requests: write}
    outputs:
      releases_created: ${{ steps.rp.outputs.releases_created }}
      tag_name: ${{ steps.rp.outputs.tag_name }}
    steps:
      - id: rp
        uses: google-github-actions/release-please-action@PIN_RELEASE_PLEASE
        with: {token: "${{ secrets.GITHUB_TOKEN }}"}

  Publish:
    needs: Release-please
    if: needs.Release-please.outputs.releases_created == 'true'
    permissions: {}
    uses: ./.github/workflows/publish.yml
```

- [ ] **Step 4: `.github/workflows/publish.yml`**

```yaml
name: Publish
on:
  workflow_call:
  workflow_dispatch:

permissions: {}

jobs:
  Publish:
    runs-on: ubuntu-latest
    permissions: {contents: write, id-token: write}
    steps:
      - uses: actions/checkout@PIN_CHECKOUT
        with: {fetch-depth: 0}
      - uses: actions/setup-node@PIN_SETUP_NODE
        with: {node-version: 20, cache: npm, registry-url: https://registry.npmjs.org}
      - run: npm ci
      - run: npm test
      - run: |
          git fetch --tags origin
          TAG="v$(node -p "require('./package.json').version")"
          echo "TAG=$TAG" >> "$GITHUB_ENV"
          node scripts/verify-release.mjs "$TAG"
      - run: npm pack --dry-run --json | node scripts/check-pack-list.mjs
      - run: npm publish --provenance --access public
        env: {NODE_AUTH_TOKEN: "${{ secrets.GITHUB_TOKEN }}"}
      - run: |
          node scripts/extract-changelog.mjs body.md
          gh release create "$TAG" --notes-file body.md --title "$TAG" --verify-tag
        env: {GH_TOKEN: "${{ github.token }}"}
```

Note: with OIDC trusted publishing registered in npmjs.com, `npm publish --provenance` authenticates via `id-token: write` — no NODE_AUTH_TOKEN needed once trusted publisher is active; keeping NODE_AUTH_TOKEN set is harmless and covers the window before registration (GITHUB_TOKEN is rejected by npm, so pre-registration runs fail fast at publish step rather than mis-publishing). If gh api confirms trusted-publisher registration impossible autonomously, first real release requires the manual checklist step from `docs/guide/publishing.md`.

- [ ] **Step 5: Rewrite `docs/guide/publishing.md`** around the automated flow: merge conventional commits → Release PR appears → merges green → tag + npm publish + GitHub Release happen automatically; emergency manual fallback section (old content preserved verbatim as fallback); one-time setup list (npm trusted publisher registration URL flow).

- [ ] **Step 6: Verify & commit** — pinning checker green; manifest JSON valid; `npm run lint`. Commits `ci(release): release-please pipeline (TASK-10)` + `ci(publish): tag-triggered OIDC publish workflow (TASK-11)`.

---

### Task 6 (backlog TASK-12): Weekly + monthly QA

**Files:**
- Create: `scripts/report-to-issue.mjs`, `test/unit/report-to-issue.test.ts`, `.github/workflows/qa-weekly.yml`, `.github/workflows/qa-monthly.yml`

**Interfaces:**
- Consumes: Task 2 scripts.
- Produces: `reportToIssue({title, body, label})` — finds an open issue with exact title and appends a dated comment, else creates the issue labeled `ci-failure`.

- [ ] **Step 1: TDD `report-to-issue` core (match logic)**

Test the pure part `pickIssue(issues, title)` returning matching issue number or null; gh interaction stays thin untested shell-out.

```ts
import { describe, expect, it } from 'vitest';
import { pickIssue } from '../../scripts/report-to-issue.mjs';

describe('pickIssue', () => {
  const issues = [{number: 7, title: 'Dependency Health'}, {number: 9, title: 'Other'}];
  it('matches exact open issue title case-insensitively', () => {
    expect(pickIssue(issues, 'dependency health')).toBe(7);
    expect(pickIssue(issues, 'missing')).toBeNull();
  });
});
```

Implementation: `pickIssue` exported; CLI main reads `--title --body-file --label`, calls `gh issue list --state open --json number,title`, picks, else `gh label create <label> --force` then `gh issue create --label`. Dated comment via `gh issue comment <n> --body-file` prefixed `<!-- QA <iso-date> -->`.

- [ ] **Step 2: `qa-weekly.yml`**

```yaml
name: Weekly QA
on:
  schedule:
    - cron: "0 4 * * 1"
  workflow_dispatch:

permissions: {}

jobs:
  Tests:
    strategy:
      fail-fast: false
      matrix:
        os: [windows-latest, ubuntu-latest]
        node: [20, 22]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@PIN_CHECKOUT
      - uses: actions/setup-node@PIN_SETUP_NODE
        with: {node-version: "${{ matrix.node }}", cache: npm}
      - run: npm ci
      - run: npm test

  Audit:
    runs-on: ubuntu-latest
    permissions: {issues: write, contents: read}
    steps:
      - uses: actions/checkout@PIN_CHECKOUT
      - uses: actions/setup-node@PIN_SETUP_NODE
        with: {node-version: 20, cache: npm}
      - run: npm ci
      - id: audit
        continue-on-error: true
        run: npm audit --omit=dev --json > audit.json
      - if: always() && hashFiles('audit.json') != ''
        env: {GH_TOKEN: "${{ github.token }}", GH_REPO: "${{ github.repository }}"}
        run: node scripts/report-audit.mjs audit.json

  Dependency-health:
    runs-on: ubuntu-latest
    permissions: {issues: write, contents: read}
    steps:
      - uses: actions/checkout@PIN_CHECKOUT
      - uses: actions/setup-node@PIN_SETUP_NODE
        with: {node-version: 20, cache: npm}
      - run: npm ci
      - env: {GH_TOKEN: "${{ github.token }}", GH_REPO: "${{ github.repository }}"}
        run: |
          npm outdated --json || true
          node scripts/report-health.mjs
```

(`report-audit.mjs` prints human summary from audit JSON into `report-to-issue` with title "npm audit findings"; `report-health.mjs` wraps `report-to-issue` with fixed title "Dependency Health" and `npm outdated` output as body.)

- [ ] **Step 3: `qa-monthly.yml`**

```yaml
name: Monthly deep check
on:
  schedule:
    - cron: "0 5 1 * *"
  workflow_dispatch:

permissions: {}

jobs:
  Package-smoke:
    runs-on: ubuntu-latest
    permissions: {}
    steps:
      - uses: actions/checkout@PIN_CHECKOUT
      - uses: actions/setup-node@PIN_SETUP_NODE
        with: {node-version: 20, cache: npm}
      - run: npm ci
      - run: npm run build
      - run: |
          npm pack --json > pack.json
          TGZ=$(node -p "JSON.parse(require('fs').readFileSync('pack.json','utf8'))[0].filename")
          mkdir "$RUNNER_TEMP/pkg" && tar -xzf "$TGZ" -C "$RUNNER_TEMP/pkg"
          node "$RUNNER_TEMP/pkg/package/dist/cli.js" --version
          node "$RUNNER_TEMP/pkg/package/dist/cli.js" --help
      - run: |
          node dist/cli.js dashboard --no-open --out "$RUNNER_TEMP/dashboard.html"
          SIZE=$(wc -c < "$RUNNER_TEMP/dashboard.html")
          test "$SIZE" -gt 1000

  Pages-healthcheck:
    runs-on: ubuntu-latest
    permissions: {issues: write}
    steps:
      - id: probe
        continue-on-error: true
        run: |
          CODE=$(curl -fsS -o page.html -w "%{http_code}" https://adam-s-k-i.github.io/super-backlog/)
          grep -qi "super-backlog" page.html
          echo "code=$CODE" >> "$GITHUB_OUTPUT"
      - if: steps.probe.outcome == 'failure'
        env: {GH_TOKEN: "${{ github.token }}", GH_REPO: "${{ github.repository }}"}
        run: |
          printf 'Docs site healthcheck failed on %s.\n\n<details><summary>probe output</summary>\n\n```\n%s\n```\n</details>\n' "$(date -u +%F)" "$(curl -sSI https://adam-s-k-i.github.io/super-backlog/ || true)" > body.md
          node scripts/report-to-issue.mjs --title "Pages healthcheck failing" --body-file body.md --label ci-failure
```

- [ ] **Step 4: Unit-test helpers, verify & commit** — `npx vitest run test/unit/report-to-issue.test.ts`, pinning check, `npm run lint`. Commit `ci(qa): weekly matrix/audit/health + monthly deep check (TASK-12)`.

---

### Task 7 (backlog TASK-13): Security hardening pass

**Files:**
- Create: `CODEOWNERS` (`.github/CODEOWNERS`)
- Modify: all workflow files created above (final permissions audit), `docs/guide/publishing.md` checklist cross-link

**Interfaces:**
- Consumes: everything before.
- Produces: repo settings (attempted via `gh api`), documented pending-manual list otherwise.

- [ ] **Step 1: `.github/CODEOWNERS`** — `* @adam-s-k-i`

- [ ] **Step 2: Permissions audit** — grep all workflows for jobs lacking explicit `permissions:` or using broad scopes; fix inline. Confirm no `pull_request_target` anywhere: `grep -rn "pull_request_target" .github/workflows/` → empty.

- [ ] **Step 3: Attempt repo settings via gh (best-effort, record results)**

```bash
gh api -X PUT repos/adam-s-k-i/super-backlog/vulnerability-alerts
gh api -X PUT repos/adam-s-k-i/super-backlog/automated-security-fixes
gh api -X PATCH repos/adam-s-k-i/super-backlog -f security_and_analysis[secret_scanning][status]=enabled -f security_and_analysis[secret_scanning_push_protection][status]=enabled
# Branch protection LAST, after final master push (see Task 9):
gh api -X PUT repos/adam-s-k-i/super-backlog/branches/master/protection --input - <<< '{"required_status_checks":{"strict":true,"contexts":["Lint","Guard","Tests"]},"enforce_admins":false,"required_pull_request_reviews":null,"restrictions":null,"allow_force_pushes":false,"required_conversation_resolution":true}'
```

Deviation note (documented in operations doc): spec said "PRs required"; solo-maintainer reality makes self-review deadlock, so protection enforces required checks + linear history without mandatory PRs until collaborators exist. Follow own-recommendation mandate.

- [ ] **Step 4: Verify & commit** — pinning + lint green. Commit `ci(security): least privilege audit, CODEOWNERS, guard enforcement (TASK-13)`.

---

### Task 8 (backlog TASK-14): Operations documentation + rollout dry-runs

**Files:**
- Create: `docs/guide/operations.md`
- Modify: `README.md` (link operations guide)

**Interfaces:**
- Consumes: every workflow above.

- [ ] **Step 1: Write `docs/guide/operations.md`** — table of all workflows (name, trigger incl. cron times, permissions, failure behavior → `ci-failure` issues), release chain narrative incl. workflow_call rationale, one-time setup checklist (npm trusted publisher, branch protection, secret scanning, Pages source `gh api -X POST repos/../pages -f build_type=workflow`, labels ensured, release-please first run), dry-run log section.

- [ ] **Step 2: Rollout after push (see Task 9 ordering)** — ensure labels: loop `gh label create X --force` for ci-failure autorelease dependencies ci docs cli tests qa security pages stale; enable Pages source; dispatch dry-runs: `gh workflow run "Deploy Pages"`, `"Weekly QA"`, `"Monthly deep check"`, `"Stale"`, `"PR hygiene"` (PR-less noop ok), `"Publish"` (expected: fails fast at verify-release guard = correct guard behavior, recorded as evidence); `"Release"` (release-please initial run creates Release PR for next version — leave open, it self-merges when green).

- [ ] **Step 3: Verify & commit** — lint green; operations doc lists real dispatch run URLs. Commit `docs(ops): operations guide + rollout evidence (TASK-14)`.

---

### Task 9: Integration — merge, push, post-push verification

- [ ] **Step 1: Full local gate** — `npm ci && npm run lint && npm test` green on worktree.
- [ ] **Step 2: Backlog finalization** — read `task-finalization` instructions; per task: tick ACs with evidence, set Done via CLI, final summaries.
- [ ] **Step 3: Merge** `feat/github-automation` → master (no-ff), push master.
- [ ] **Step 4: Post-push** — watch CI run green; execute Task 8 Step 2 rollout commands; attempt Task 7 branch protection last; re-run `npm outdated` locally sanity.
- [ ] **Step 5: Final report** — summarize runs, URLs, pending manual items.
