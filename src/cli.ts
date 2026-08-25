#!/usr/bin/env node
// src/cli.ts
import { parseArgs } from 'node:util';
import process from 'node:process';

import { runDashboard } from './commands/dashboard.js';
import { runInit } from './commands/init.js';
import { runUninstall } from './commands/uninstall.js';
import { runUpdate } from './commands/update.js';
import { assertNode20, KIT_VERSION } from './lib/version.js';

const HELP = `super-backlog (sbl) - equip any project with Backlog.md + Superpowers

Usage: sbl <command> [options]

Commands:
  init        Install the kit into the current project
  uninstall   Remove kit-managed files (project data kept unless --with-backlog)
  update      Refresh kit-managed files and report upstream versions
  dashboard   Generate the single-file project dashboard (--serve for live mode)

init options:
  --pm <auto|npm|pnpm|bun|skip>   Package manager to use (default: auto)
  --harness <opencode|claude>     Target harness; repeatable or comma-separated (default: both)
  --guard                         Install the integrity pre-commit hook (opt-in)
  --no-dashboard                  Skip generating the project dashboard
  --dry-run                       Show what would be done without writing anything

uninstall options:
  --with-backlog                  Also permanently delete the backlog/ data directory

update options:
  (none)                          Refreshes injected files, skills, hook; prints upstream versions

dashboard options:
  --serve                         Live mode: watch backlog/ and regenerate on changes
  --port <n>                      Port for --serve (default: 6428)
  --no-open                       With --serve: do not open the browser automatically
  --out <file>                    Output file name or path (default: dashboard.html)

Global options:
  --version                       Print the super-backlog version and exit

Exit codes:
  0 ok | 1 usage/detection failure | 2 ownership or merge refusal
  3 upstream command failure | 4 success with warnings`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (command === '--version' || command === '-v') {
    console.log(KIT_VERSION);
    return 0;
  }

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
    case 'uninstall': {
      const parsed = parseArgs({
        args: rest,
        allowPositionals: true,
        options: { 'with-backlog': { type: 'boolean' } },
      });
      return runUninstall(process.cwd(), {
        values: parsed.values as Record<string, string | boolean | undefined>,
        positionals: parsed.positionals,
      });
    }
    case 'update': {
      const parsed = parseArgs({ args: rest, allowPositionals: true, options: {} });
      return await runUpdate(process.cwd(), {
        values: parsed.values as Record<string, string | boolean | undefined>,
        positionals: parsed.positionals,
      });
    }
    case 'dashboard': {
      const parsed = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          serve: { type: 'boolean' },
          port: { type: 'string' },
          'no-open': { type: 'boolean' },
          out: { type: 'string' },
        },
      });
      return await runDashboard(process.cwd(), {
        values: parsed.values as Record<string, string | boolean | undefined>,
        positionals: parsed.positionals,
      });
    }
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
