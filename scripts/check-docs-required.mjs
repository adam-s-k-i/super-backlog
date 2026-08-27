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
  return t ? t[1].replace(/^['"]|['"]$/g, '') : null;
}

export function docsLinkFor(path) {
  const rel = path.replace(/^docs\//, '').replace(/\.md$/, '');
  return rel.endsWith('/index') ? `/${rel.slice(0, -'index'.length)}` : `/${rel}`;
}

function sidebarLinksFor(path) {
  const link = docsLinkFor(path);
  return link.endsWith('/') ? [link, link.slice(0, -1)] : [link];
}

function isLinked(sidebarText, path) {
  return sidebarLinksFor(path).some((link) => {
    const escaped = link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`link:\\s*['"]${escaped}['"]`).test(sidebarText);
  });
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
  const touchesDocs = paths.some((p) => DOCS_PAGE.test(p) && !p.startsWith('docs/superpowers/'));
  if (isFeatureTitle(prTitle) && touchesSrc && !touchesDocs && !labels.includes('no-docs')) {
    problems.push(
      'Feature PR changes src/ without a docs/ update. Add or update a page under docs/ (see CONTRIBUTING.md > Documentation) or apply the "no-docs" label if the feature has no user-facing surface.'
    );
  }
  for (const f of changedFiles) {
    if (!['A', 'R'].includes(f.status) || !DOCS_PAGE.test(f.path) || f.path.startsWith('docs/superpowers/')) continue;
    const type = frontmatterType(readContent(f.path));
    if (!VALID_TYPES.includes(type)) {
      problems.push(
        `New page ${f.path} needs frontmatter "type: ${VALID_TYPES.join('|')}" (got ${type === null ? 'none' : `"${type}"`}).`
      );
    }
    if (!isLinked(sidebarText, f.path)) {
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
  try {
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
  } catch (err) {
    console.error(`Docs gate could not run: ${err.message}`);
    console.error('Check that the base ref exists (fetch the PR base branch) and that docs/.vitepress/config.mts is present.');
    process.exit(1);
  }
}
