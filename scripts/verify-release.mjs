import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export function verifyRelease({ version, changelogText, remoteTagExists }) {
  const problems = [];
  const header = new RegExp(`^## \\[[v]?${version.replace(/\./g, '\\.')}\\]`, 'm');
  if (!header.test(changelogText)) problems.push(`CHANGELOG.md has no entry for ${version}`);
  if (!remoteTagExists) problems.push(`remote tag v${version} does not exist`);
  return problems;
}

export function extractChangelogSection(text, version) {
  const lines = text.split(/\r?\n/);
  const startIdx = lines.findIndex((l) =>
    new RegExp(`^## \\[[v]?${version.replace(/\./g, '\\.')}\\]`).test(l)
  );
  if (startIdx === -1) return null;
  const endIdx = lines.findIndex((l, i) => i > startIdx && /^## \[/.test(l));
  return lines.slice(startIdx + 1, endIdx === -1 ? lines.length : endIdx).join('\n').trim();
}

function remoteTagExists(tagRef) {
  try {
    const out = execFileSync('git', ['ls-remote', 'origin', `refs/tags/${tagRef}`], {
      encoding: 'utf8'
    });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

if (process.argv[1]?.endsWith('verify-release.mjs')) {
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const cl = readFileSync('CHANGELOG.md', 'utf8');
  const tagRef = process.argv[2] ?? `v${version}`;
  const problems = verifyRelease({
    version,
    changelogText: cl,
    remoteTagExists: remoteTagExists(tagRef)
  });
  if (problems.length) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
}
