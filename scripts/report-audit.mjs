#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { reportToIssue } from './report-to-issue.mjs';

const file = process.argv[2] ?? 'audit.json';
let audit;
try {
  audit = JSON.parse(readFileSync(file, 'utf8'));
} catch {
  console.error(`report-audit: cannot parse ${file}`);
  process.exit(1);
}

const meta = audit.metadata?.vulnerabilities ?? {};
const total = Object.values(meta).reduce((a, b) => a + b, 0);
if (total === 0) {
  console.log('no known vulnerabilities');
  process.exit(0);
}

const lines = [
  `\`${total}\` production vulnerability/vulnerabilities found by \`npm audit --omit=dev\`:`,
  '',
  '| severity | count |',
  '| --- | --- |'
];
for (const sev of ['critical', 'high', 'moderate', 'low', 'info']) {
  if (meta[sev]) lines.push(`| ${sev} | ${meta[sev]} |`);
}
lines.push('', '<details><summary>Raw audit output</summary>', '', '```json');
lines.push(JSON.stringify(audit.vulnerabilities ?? {}, null, 2));
lines.push('```', '</details>');

const result = reportToIssue({
  title: 'npm audit findings',
  body: lines.join('\n'),
  label: 'ci-failure'
});
console.log(
  result.created ? `created issue #${result.number}` : `commented on issue #${result.number}`
);
