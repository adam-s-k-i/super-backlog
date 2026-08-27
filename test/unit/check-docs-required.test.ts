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
