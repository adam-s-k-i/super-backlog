#!/usr/bin/env node
const PATTERN = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w./-]+\))?!?: \S.+/;

export function isValidTitle(title) {
  return PATTERN.test(title);
}

if (process.argv[1]?.endsWith('check-pr-title.mjs')) {
  const title = process.argv[2] ?? process.env.PR_TITLE ?? '';
  if (!isValidTitle(title)) {
    console.error(`Invalid PR title: "${title}"`);
    console.error('Expected Conventional Commits format: type(scope)?: subject');
    process.exit(1);
  }
}
