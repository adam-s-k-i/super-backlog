#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { extractChangelogSection } from './verify-release.mjs';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const section = extractChangelogSection(readFileSync('CHANGELOG.md', 'utf8'), version);
if (!section) {
  console.error(`No CHANGELOG section for ${version}`);
  process.exit(1);
}
if (process.argv[2]) writeFileSync(process.argv[2], section);
else process.stdout.write(section);
