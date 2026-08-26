import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

export function pickIssue(issues, title) {
  const needle = title.toLowerCase();
  const hit = issues.find((i) => i.title.toLowerCase() === needle);
  return hit ? hit.number : null;
}

function gh(args, opts = {}) {
  return execFileSync('gh', args, { encoding: 'utf8', ...opts }).trim();
}

export function reportToIssue({ title, body, label }) {
  let issues = [];
  try {
    issues = JSON.parse(gh(['issue', 'list', '--state', 'open', '--json', 'number,title']) || '[]');
  } catch {
    issues = [];
  }
  const existing = pickIssue(issues, title);
  const date = new Date().toISOString().slice(0, 10);
  const dated = `<!-- QA ${date} -->\n\n${body}`;
  const dir = mkdtempSync(join(tmpdir(), 'sbl-report-'));
  const bodyFile = join(dir, 'body.md');
  writeFileSync(bodyFile, dated, 'utf8');
  if (existing !== null) {
    gh(['issue', 'comment', String(existing), '--body-file', bodyFile]);
    return { number: existing, created: false };
  }
  const args = ['issue', 'create', '--title', title, '--body-file', bodyFile];
  if (label) {
    try {
      gh(['label', 'create', label, '--force']);
    } catch {
      /* label may already exist with color */
    }
    args.push('--label', label);
  }
  const url = gh(args);
  const number = Number(url.match(/\/issues\/(\d+)$/)?.[1] ?? -1);
  return { number, created: true };
}

if (process.argv[1]?.endsWith('report-to-issue.mjs')) {
  const argv = process.argv.slice(2);
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const title = get('--title');
  const bodyFile = get('--body-file');
  if (!title || !bodyFile) {
    console.error('usage: report-to-issue.mjs --title <t> --body-file <f> [--label <l>]');
    process.exit(1);
  }
  const result = reportToIssue({
    title,
    body: readFileSync(bodyFile, 'utf8'),
    label: get('--label')
  });
  console.log(
    result.created ? `created issue #${result.number}` : `commented on issue #${result.number}`
  );
}
