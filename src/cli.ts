#!/usr/bin/env node
// src/cli.ts
import { parseArgs } from 'node:util';
import process from 'node:process';

import { runInit } from './commands/init.js';
import { assertNode20 } from './lib/version.js';

const HELP = `super-backlog (sbl) - equip any project with Backlog.md + Superpowers

Usage: sbl <command> [options]

Commands:
  init        Install the kit into the current project
  uninstall   Remove kit-managed files (not implemented yet)
  update      Refresh kit-managed files (not implemented yet)
  dashboard   Serve the generated project dashboard (not implemented yet)

init options:
  --pm <auto|npm|pnpm|bun|skip>   Package manager to use (default: auto)
  --harness <opencode|claude>     Target harness; repeatable or comma-separated (default: both)
  --guard                         Install the pre-commit guard hook (default: on)
  --no-dashboard                  Skip generating the project dashboard
  --dry-run                       Show what would be done without writing anything

Exit codes:
  0 ok | 1 usage/detection failure | 2 ownership or merge refusal
  3 upstream command failure | 4 success with warnings`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP);
    return 0;
  }

  switch (command) {
    case 'init': {
      const parsed = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          pm: { type: 'string' },
          harness: { type: 'string', multiple: true },
          guard: { type: 'boolean' },
          'no-dashboard': { type: 'boolean' },
          'dry-run': { type: 'boolean' },
        },
      });
      return await runInit(process.cwd(), {
        values: parsed.values as Record<string, string | boolean | undefined>,
        positionals: parsed.positionals,
      });
    }
    case 'uninstall':
    case 'update':
    case 'dashboard':
      console.error(`"${command}" is not implemented yet in this version.\n`);
      console.error(HELP);
      return 1;
    default:
      console.error(`Unknown command "${command}".\n`);
      console.error(HELP);
      return 1;
  }
}

assertNode20();

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
