# Docs Freshness Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee that user-facing features always ship with docs updates, enforced by a hard, locally testable CI gate, plus a binding docs style guide so GitHub Pages stays detailed yet minimalist and clear from a user's perspective.

**Architecture:** A new Node script `scripts/check-docs-required.mjs` (pure core function + thin CLI wrapper, following the `scripts/verify-release.mjs` pattern) runs as a `Docs-Gate` job in the existing `pr-hygiene.yml` workflow. A Documentation section in `CONTRIBUTING.md` defines the binding Diátaxis page types; existing pages get `type` frontmatter backfilled.

**Tech Stack:** Node 22 ESM scripts (zero runtime dependencies), vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-27-docs-freshness-gate-design.md`

**Backlog tasks:** TASK-27 (script + tests), TASK-28 (workflow wiring, dep TASK-27), TASK-29 (style guide + backfill)

## Global Constraints

- TypeScript strict mode, ESM; import from `node:path` / `node:url`; zero runtime dependencies.
- All user-facing strings in English.
- TDD: failing test first, then implementation.
- GitHub Actions must be SHA-pinned (enforced by `scripts/check-action-pinning.mjs`).
- Conventional Commits for all commits and PR titles.
- Gate rules (from spec, verbatim decisions):
  - Trigger: PR title matches `^feat(\([\w./-]+\))?!?:` AND a changed file under `src/` → then a `docs/**/*.md` change is required.
  - Exemption: PR label `no-docs`.
  - New pages (git status `A`) under `docs/**/*.md` need frontmatter `type:` of `tutorial`, `how-to`, `reference` or `explanation`; `docs/superpowers/**` is exempt.
  - New pages must be linked in `docs/.vitepress/config.mts` (sidebar).
  - `fix:`, `chore:`, `docs:`, `refactor:`, `perf:` titles are never gated.

---

### Task 1: Gate script `scripts/check-docs-required.mjs` with unit tests (TASK-27)

**Files:**
- Create: `scripts/check-docs-required.mjs`
- Test: `test/unit/check-docs-required.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces (Task 3 relies on these):
  - `checkDocsRequired({ prTitle, labels, changedFiles, sidebarText, readContent })` → `string[]` (violation messages; empty = pass). `changedFiles` entries are `{ status: 'A'|'M'|'D'|'R', path: string }`; `readContent` is `(path: string) => string`.
  - `parseNameStatus(text)` → `Array<{ status, path }>` (parses `git diff --name-status` output).
  - CLI: `node scripts/check-docs-required.mjs [--title T] [--labels a,b] [--base ref]` — reads PR title/labels from `$GITHUB_EVENT_PATH` when flags absent, diffs `--base` (default `origin/$GITHUB_BASE_REF` or `origin/master`) against `HEAD`, exits 1 with violations on stderr.

- [ ] **Step 1: Write the failing test file**

Create `test/unit/check-docs-required.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  checkDocsRequired,
  docsLinkFor,
  frontmatterType,
  isFeatureTitle,
  parseNameStatus
} from '../../scripts/check-docs-required.mjs';

const PAGE = ['---', 'type: how-to', '---', '', '# Page'].join('\n');
const PAGE_NO_TYPE = '# Page\n';
const PAGE_BAD_TYPE = ['---', 'type: guide', '---', '', '# Page'].join('\n');
const SIDEBAR = "items: [{ text: 'X', link: '/guide/x' }]";

const feat = { prTitle: 'feat: add thing', labels: [], sidebarText: SIDEBAR };
const added = (path) => [{ status: 'A', path }];

describe('isFeatureTitle', () => {
  it('matches plain, scoped and breaking variants', () => {
    expect(isFeatureTitle('feat: x')).toBe(true);
    expect(isFeatureTitle('feat(cli): x')).toBe(true);
    expect(isFeatureTitle('feat!: x')).toBe(true);
    expect(isFeatureTitle('feat(cli)!: x')).toBe(true);
  });

  it('rejects non-feature types', () => {
    for (const t of ['fix: x', 'chore: x', 'docs: x', 'refactor: x', 'perf: x', 'chore(master): release 1.0.0']) {
      expect(isFeatureTitle(t)).toBe(false);
    }
  });
});

describe('frontmatterType', () => {
  it('reads the type from a frontmatter block', () => {
    expect(frontmatterType(PAGE)).toBe('how-to');
  });

  it('returns null without a frontmatter block', () => {
    expect(frontmatterType(PAGE_NO_TYPE)).toBeNull();
  });

  it('returns the raw value for invalid types', () => {
    expect(frontmatterType(PAGE_BAD_TYPE)).toBe('guide');
  });
});

describe('docsLinkFor', () => {
  it('maps a docs path to its site link', () => {
    expect(docsLinkFor('docs/guide/x.md')).toBe('/guide/x');
    expect(docsLinkFor('docs/operations.md')).toBe('/operations');
  });
});

describe('parseNameStatus', () => {
  it('parses added, modified and renamed entries', () => {
    expect(parseNameStatus('A\tdocs/guide/x.md\nM\tsrc/cli.ts\nR100\told.md\tdocs/guide/y.md\n')).toEqual([
      { status: 'A', path: 'docs/guide/x.md' },
      { status: 'M', path: 'src/cli.ts' },
      { status: 'R', path: 'docs/guide/y.md' }
    ]);
  });
});

describe('checkDocsRequired docs-change requirement', () => {
  it('reports a violation for feat + src change without docs', () => {
    const problems = checkDocsRequired({ ...feat, changedFiles: [{ status: 'M', path: 'src/cli.ts' }] });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('src/');
  });

  it('passes when a docs change is included', () => {
    expect(
      checkDocsRequired({
        ...feat,
        changedFiles: [
          { status: 'M', path: 'src/cli.ts' },
          { status: 'M', path: 'docs/guide/quickstart.md' }
        ]
      })
    ).toEqual([]);
  });

  it('passes for a feat PR touching only docs', () => {
    expect(checkDocsRequired({ ...feat, changedFiles: [{ status: 'M', path: 'docs/guide/quickstart.md' }] })).toEqual([]);
  });

  it('passes with the no-docs label', () => {
    expect(
      checkDocsRequired({ ...feat, labels: ['no-docs'], changedFiles: [{ status: 'M', path: 'src/cli.ts' }] })
    ).toEqual([]);
  });

  it('does not gate non-feature titles', () => {
    expect(
      checkDocsRequired({
        prTitle: 'fix: bug',
        labels: [],
        changedFiles: [{ status: 'M', path: 'src/cli.ts' }],
        sidebarText: ''
      })
    ).toEqual([]);
  });
});

describe('checkDocsRequired new page rules', () => {
  it('requires a valid type frontmatter on new pages', () => {
    const problems = checkDocsRequired({
      ...feat,
      changedFiles: added('docs/guide/x.md'),
      readContent: () => PAGE_NO_TYPE
    });
    expect(problems.some((p) => p.includes('type:'))).toBe(true);
  });

  it('rejects invalid type values', () => {
    const problems = checkDocsRequired({
      ...feat,
      changedFiles: added('docs/guide/x.md'),
      readContent: () => PAGE_BAD_TYPE
    });
    expect(problems.some((p) => p.includes('"guide"'))).toBe(true);
  });

  it('requires a sidebar link for new pages', () => {
    const problems = checkDocsRequired({
      ...feat,
      sidebarText: 'items: []',
      changedFiles: added('docs/guide/x.md'),
      readContent: () => PAGE
    });
    expect(problems.some((p) => p.includes('config.mts'))).toBe(true);
  });

  it('passes for a well-formed linked page', () => {
    expect(
      checkDocsRequired({ ...feat, changedFiles: added('docs/guide/x.md'), readContent: () => PAGE })
    ).toEqual([]);
  });

  it('exempts docs/superpowers pages from type and nav rules', () => {
    expect(
      checkDocsRequired({
        ...feat,
        changedFiles: added('docs/superpowers/specs/x.md'),
        readContent: () => PAGE_NO_TYPE
      })
    ).toEqual([]);
  });

  it('reports multiple violations at once', () => {
    const problems = checkDocsRequired({
      ...feat,
      changedFiles: added('docs/guide/y.md'),
      readContent: () => PAGE_NO_TYPE
    });
    expect(problems).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/check-docs-required.test.ts`
Expected: FAIL — module `../../scripts/check-docs-required.mjs` does not exist.

- [ ] **Step 3: Implement the script**

Create `scripts/check-docs-required.mjs`:

```js
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FEATURE_TITLE = /^feat(\([\w./-]+\))?!?:/;
const VALID_TYPES = ['tutorial', 'how-to', 'reference', 'explanation'];
const DOCS_PAGE = /^docs\/.*\.md$/;

export function isFeatureTitle(prTitle) {
  return FEATURE_TITLE.test(prTitle);
}

export function frontmatterType(content) {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const t = fm[1].match(/^type:\s*(\S+)\s*$/m);
  return t ? t[1] : null;
}

export function docsLinkFor(path) {
  return `/${path.replace(/^docs\//, '').replace(/\.md$/, '')}`;
}

export function parseNameStatus(text) {
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      return { status: parts[0][0], path: parts[parts.length - 1] };
    });
}

export function checkDocsRequired({
  prTitle = '',
  labels = [],
  changedFiles = [],
  sidebarText = '',
  readContent = () => ''
}) {
  const problems = [];
  const paths = changedFiles.map((f) => f.path);
  const touchesSrc = paths.some((p) => p.startsWith('src/'));
  const touchesDocs = paths.some((p) => DOCS_PAGE.test(p));
  if (isFeatureTitle(prTitle) && touchesSrc && !touchesDocs && !labels.includes('no-docs')) {
    problems.push(
      'Feature PR changes src/ without a docs/ update. Add or update a page under docs/ (see CONTRIBUTING.md > Documentation) or apply the "no-docs" label if the feature has no user-facing surface.'
    );
  }
  for (const f of changedFiles) {
    if (f.status !== 'A' || !DOCS_PAGE.test(f.path) || f.path.startsWith('docs/superpowers/')) continue;
    const type = frontmatterType(readContent(f.path));
    if (!VALID_TYPES.includes(type)) {
      problems.push(
        `New page ${f.path} needs frontmatter "type: ${VALID_TYPES.join('|')}" (got ${type === null ? 'none' : `"${type}"`}).`
      );
    }
    if (!sidebarText.includes(docsLinkFor(f.path))) {
      problems.push(
        `New page ${f.path} is not linked in docs/.vitepress/config.mts (sidebar) and would be invisible on GitHub Pages.`
      );
    }
  }
  return problems;
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : process.argv[i + 1];
}

if (process.argv[1]?.endsWith('check-docs-required.mjs')) {
  let prTitle = argValue('--title') ?? '';
  let labels = (argValue('--labels') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!prTitle && eventPath) {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    prTitle = event.pull_request?.title ?? '';
    labels = (event.pull_request?.labels ?? []).map((l) => l.name);
  }
  const base = argValue('--base') ?? `origin/${process.env.GITHUB_BASE_REF || 'master'}`;
  const diff = execFileSync('git', ['diff', '--name-status', `${base}...HEAD`], { encoding: 'utf8' });
  const problems = checkDocsRequired({
    prTitle,
    labels,
    changedFiles: parseNameStatus(diff),
    sidebarText: readFileSync('docs/.vitepress/config.mts', 'utf8'),
    readContent: (p) => readFileSync(p, 'utf8')
  });
  if (problems.length) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log('Docs gate passed');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/unit/check-docs-required.test.ts`
Expected: PASS (all describes green).

- [ ] **Step 5: Smoke-test the CLI locally**

Run: `node scripts/check-docs-required.mjs --title "feat: demo" --base HEAD`
Expected: exit 0, prints `Docs gate passed` (empty diff against HEAD → no violations).

Run: `node scripts/check-docs-required.mjs --title "docs: demo" --base HEAD`
Expected: exit 0 as well.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS (build + all tests, including the new file).

- [ ] **Step 7: Commit**

```bash
git add scripts/check-docs-required.mjs test/unit/check-docs-required.test.ts
git commit -m "feat: add docs freshness gate script with unit tests"
```

---

### Task 2: Documentation style guide + type frontmatter backfill (TASK-29)

**Files:**
- Modify: `CONTRIBUTING.md` (append a `## Documentation` section after `## PR checklist`)
- Modify: `docs/index.md`, `docs/operations.md`, `docs/guide/quickstart.md`, `docs/guide/architecture.md`, `docs/guide/harness-support.md`, `docs/guide/guard.md`, `docs/guide/operations.md`, `docs/guide/publishing.md`, `docs/guide/troubleshooting.md` (prepend frontmatter)

**Interfaces:**
- Consumes: nothing from Task 1 (independent; can run in parallel).
- Produces: the `type` frontmatter convention that Task 1's gate validates.

- [ ] **Step 1: Append the style guide to CONTRIBUTING.md**

Append exactly this section at the end of `CONTRIBUTING.md`:

```markdown

## Documentation

Every docs page under `docs/` (except `docs/superpowers/`) declares a [Diátaxis](https://diataxis.fr/) type in its frontmatter:

- **tutorial** (`type: tutorial`) — learning-oriented; guides a newcomer step by step to a working result.
- **how-to** (`type: how-to`) — task-oriented; solves one concrete user problem, assumes existing context.
- **reference** (`type: reference`) — information-oriented; complete and factual, no narrative.
- **explanation** (`type: explanation`) — understanding-oriented; background, concepts, trade-offs.

Rules:

- One page covers exactly one topic, written from the user's perspective — detailed in content, minimalist in presentation.
- New pages must be linked in `docs/.vitepress/config.mts` (sidebar); unlinked pages are invisible on GitHub Pages.
- A CI gate (Docs-Gate job in `pr-hygiene.yml`) blocks `feat:` PRs that change `src/` without a docs update. Apply the `no-docs` label for features without user-facing surface.
```

- [ ] **Step 2: Prepend type frontmatter to the 9 existing pages**

For each file, insert the given block as the new first lines (before the current first line):

| File | Frontmatter to prepend |
|------|------------------------|
| `docs/index.md` | `---`\n`type: explanation`\n`---`\n |
| `docs/operations.md` | `---`\n`type: how-to`\n`---`\n |
| `docs/guide/quickstart.md` | `---`\n`type: tutorial`\n`---`\n |
| `docs/guide/architecture.md` | `---`\n`type: explanation`\n`---`\n |
| `docs/guide/harness-support.md` | `---`\n`type: reference`\n`---`\n |
| `docs/guide/guard.md` | `---`\n`type: explanation`\n`---`\n |
| `docs/guide/operations.md` | `---`\n`type: how-to`\n`---`\n |
| `docs/guide/publishing.md` | `---`\n`type: how-to`\n`---`\n |
| `docs/guide/troubleshooting.md` | `---`\n`type: reference`\n`---`\n |

- [ ] **Step 3: Verify lint and docs build**

Run: `npm run lint`
Expected: PASS (markdownlint + cspell clean; `Diátaxis` is already in `cspell.json` words).

Run: `npx vitepress build docs`
Expected: build succeeds, no dead-link errors.

- [ ] **Step 4: Commit**

```bash
git add CONTRIBUTING.md docs/index.md docs/operations.md docs/guide/
git commit -m "docs: add documentation style guide and type frontmatter"
```

---

### Task 3: Wire the Docs-Gate job into `pr-hygiene.yml` (TASK-28)

**Files:**
- Modify: `.github/workflows/pr-hygiene.yml` (add job after the `Labels` job)

**Interfaces:**
- Consumes: Task 1's CLI `node scripts/check-docs-required.mjs` (no flags in CI; reads `$GITHUB_EVENT_PATH` and `$GITHUB_BASE_REF`).
- Produces: a blocking PR check named `Docs-Gate`.

- [ ] **Step 1: Create the `no-docs` label (one-time, maintainer)**

```bash
gh label create no-docs --color 6B7280 --description "Exempts a feature PR from the docs-update gate"
```

Expected: label exists (`gh label list | findstr no-docs`). If it already exists, this step is a no-op.

- [ ] **Step 2: Add the Docs-Gate job**

Insert into `.github/workflows/pr-hygiene.yml`, between the `Labels` and `Auto-merge` jobs:

```yaml
  Docs-Gate:
    runs-on: ubuntu-latest
    permissions: {}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v4.2.2
        with:
          fetch-depth: 0
      - run: git fetch origin "${{ github.event.pull_request.base.ref }}" --depth=1
      - run: node scripts/check-docs-required.mjs
```

- [ ] **Step 3: Verify workflow hygiene locally**

Run: `node scripts/check-action-pinning.mjs`
Expected: PASS (the added `actions/checkout` reference is SHA-pinned).

- [ ] **Step 4: Verify the gate end-to-end via local flags (evidence for the PR)**

Simulate a violating feature PR:

```bash
git checkout -b demo-gate-violation
git commit --allow-empty -m "feat: demo"
node scripts/check-docs-required.mjs --title "feat: demo" --base origin/master
```

With only an empty commit this prints `Docs gate passed` (no files changed). For a true violation check, temporarily `git add` a touched `src/` file in the demo branch, re-run, and confirm exit 1 with the `src/` violation message; then drop the demo branch:

```bash
git checkout master
git branch -D demo-gate-violation
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/pr-hygiene.yml
git commit -m "ci: add docs gate job to pr-hygiene workflow"
```

Note: the gate triggers only on `feat:` + `src/` changes, so this `ci:` PR is not gated itself — matching the spec's edge-case decisions.
