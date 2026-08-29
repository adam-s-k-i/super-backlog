#!/usr/bin/env node
// src/bin.ts
// Always-run CLI entry. Unlike src/cli.ts (a plain module that only exports
// HELP/runCli for tests), this file self-executes unconditionally so it
// works when invoked via a symlink (npm's POSIX global/npx/npm-link bins are
// symlinks, so comparing process.argv[1] against the module's own realpath
// -- as the old cli.ts guard did -- is false for every such install).
import process from 'node:process';

import { runCli } from './cli.js';
import { assertNode20 } from './lib/version.js';

assertNode20();

runCli(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
