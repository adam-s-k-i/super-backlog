#!/usr/bin/env node
// src/cli.ts
import { parseArgs } from 'node:util';
import process from 'node:process';

import { runDashboard } from './commands/dashboard.js';
import { runBacklogSubcommand } from './commands/backlog-alias.js';
import { runDoctor } from './commands/doctor.js';
import { runInit } from './commands/init.js';
import { runModels } from './commands/models.js';
import { runServe } from './commands/serve.js';
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
  serve       Start dashboard server and the Backlog browser together
  browser     Open the Backlog.md browser (delegates to backlog browser)
  board       Show the Backlog.md board (delegates to backlog board)
  models      Manage the model router (show, enable, disable, discover)
  doctor      Check the environment (node, PowerShell policy, backlog CLI)

init options:
  --pm <auto|npm|pnpm|bun|skip>   Package manager to use (default: auto)
  --harness <opencode|claude>     Target harness; repeatable or comma-separated (default: both)
  --guard                         Install the integrity pre-commit hook (opt-in)
  --models                        Install the model router config during init (opt-in)
  --no-models                     Explicitly opt out of the model router
  --no-dashboard                  Skip generating the project dashboard
  --no-refresh-hook               Skip the post-commit dashboard freshness hook
  --fix-all                       Repair environment problems automatically (no prompts)
  --dry-run                       Show what would be done without writing anything

uninstall options:
  --with-backlog                  Also permanently delete the backlog/ data directory
  --fix-all                       Also remove the global npm package (no prompts)

update options:
  (none)                          Refreshes injected files, skills, hook; prints upstream versions

dashboard options:
  --serve                         Live mode: watch backlog/ and regenerate on changes
  --port <n>                      Port for --serve (default: 6428)
  --no-open                       With --serve: do not open the browser automatically
  --out <file>                    Output file name or path (default: dashboard.html)

serve options:
  --port <n>                      Port for the dashboard server (default: 6428)
  --no-open                       Do not open the dashboard browser automatically

doctor options:
  (none)                          Prints one [ok]/[warn]/[skip] line per check; exit 4 on any warn

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
          models: { type: 'boolean' },
          'no-models': { type: 'boolean' },
          'no-dashboard': { type: 'boolean' },
          'no-refresh-hook': { type: 'boolean' },
          'fix-all': { type: 'boolean' },
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
        options: { 'with-backlog': { type: 'boolean' }, 'fix-all': { type: 'boolean' } },
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
    case 'serve': {
      const parsed = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          port: { type: 'string' },
          'no-open': { type: 'boolean' },
          out: { type: 'string' },
        },
      });
      return await runServe(process.cwd(), {
        values: parsed.values as Record<string, string | boolean | undefined>,
        positionals: parsed.positionals,
      });
    }
    case 'browser':
      return await runBacklogSubcommand(process.cwd(), 'browser', rest);
    case 'board':
      return await runBacklogSubcommand(process.cwd(), 'board', rest);
    case 'models': {
      const parsed = parseArgs({ args: rest, allowPositionals: true, options: {} });
      return await runModels(process.cwd(), {
        values: parsed.values as Record<string, string | boolean | undefined>,
        positionals: parsed.positionals,
      });
    }
    case 'doctor':
      return runDoctor(process.cwd());
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
