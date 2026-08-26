#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pickIssue } from './report-to-issue.mjs';

function runNpmOutdated() {
  try {
    const out = execFileSync('npm', ['outdated', '--json'], {
      encoding: 'utf8',
      shell: process.platform === 'win32'
    });
    return { code: 0, json: out };
  } catch (e) {
    // npm exits 1 when packages are outdated
    return { code: e.status ?? 1, json: e.stdout ?? '{}' };
  }
}

export function buildHealthBody(jsonText) {
  let data = {};
  try {
    data = JSON.parse(jsonText || '{}');
  } catch {
    data = {};
  }
  const names = Object.keys(data);
  if (names.length === 0) return '_All dependencies are up to date._';
  const lines = ['| package | current | wanted | latest |', '| --- | --- | --- | --- |'];
  for (const n of names) {
    const d = data[n] ?? {};
    lines.push(`| ${n} | ${d.current ?? '?'} | ${d.wanted ?? '?'} | ${d.latest ?? '?'} |`);
  }
  return `Weekly dependency overview from \`npm outdated\`:\n\n${lines.join('\n')}`;
}

if (process.argv[1]?.endsWith('report-health.mjs')) {
  const issues = (() => {
    try {
      return JSON.parse(
        execFileSync('gh', ['issue', 'list', '--state', 'open', '--json', 'number,title'], {
          encoding: 'utf8',
          shell: process.platform === 'win32'
        }) || '[]'
      );
    } catch {
      return [];
    }
  })();
  const existing = pickIssue(issues, 'Dependency Health');
  const body = buildHealthBody(runNpmOutdated().json);
  const date = new Date().toISOString().slice(0, 10);
  const dir = mkdtempSync(join(tmpdir(), 'sbl-health-'));
  const bodyFile = join(dir, 'body.md');
  writeFileSync(bodyFile, `<!-- QA ${date} -->\n\n${body}`, 'utf8');
  const ghArgs =
    existing !== null
      ? ['issue', 'comment', String(existing), '--body-file', bodyFile]
      : ['issue', 'create', '--title', 'Dependency Health', '--body-file', bodyFile];
  const url = execFileSync('gh', ghArgs, { encoding: 'utf8', shell: process.platform === 'win32' });
  console.log(url.trim().split('\n').pop());
}
