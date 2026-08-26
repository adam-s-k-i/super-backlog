// src/commands/models.ts
import { loadConfig } from '../models/config.js';
import { discoverModels } from '../models/discovery.js';
import { writeRouterConfig } from '../models/install.js';
import type { ParsedArgs } from './init.js';

export async function runModels(cwd: string, args: ParsedArgs): Promise<number> {
  const sub = args.positionals[0] ?? 'show';
  switch (sub) {
    case 'show': {
      const cfg = loadConfig(cwd);
      console.log(JSON.stringify(cfg, null, 2));
      return 0;
    }
    case 'enable':
      writeRouterConfig(cwd, true);
      console.log('model router enabled');
      return 0;
    case 'disable':
      writeRouterConfig(cwd, false);
      console.log('model router disabled');
      return 0;
    case 'discover': {
      const resolved = await discoverModels(cwd);
      if (!resolved) {
        console.error('discovery failed');
        return 1;
      }
      console.log(JSON.stringify(resolved, null, 2));
      return 0;
    }
    default:
      console.error(`unknown models subcommand: ${sub}`);
      return 1;
  }
}
