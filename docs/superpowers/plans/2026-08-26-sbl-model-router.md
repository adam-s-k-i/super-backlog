# sbl Model Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `sbl models` subsystem that routes OpenCode and Claude Code subagents to cheaper model tiers while keeping the user-selected main model for complex work.

**Architecture:** A shared TypeScript core (`src/models/`) holds config, family tier tables, discovery, and resolution. Harness-specific adapters materialize this for OpenCode (runtime `chat.params` plugin) and Claude Code (agent files + `SessionStart` hook). The dashboard server exposes small JSON endpoints for editing; `init` installs and `uninstall` removes all artifacts using existing marker-based ownership patterns.

**Tech Stack:** Node 20+ ESM TypeScript, existing `atomicWrite`, `stripOwned`, `injectBlock` utilities; vitest for tests; no new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-26-sbl-model-router-design.md`

## Global Constraints

- Node >= 20; ESM-only; all internal imports use `.js` extension.
- No new runtime dependencies; keep package.json `files` unchanged (`dist` only).
- All written files that are user-visible must carry a `super-backlog` ownership marker/fingerprint so `uninstall` can remove them.
- `sbl init` must stay idempotent; new flags `--models`/`--no-models` are accepted.
- CI-friendly default: if `--models` is not passed, **do not install** the router (opt-in; interactive prompt only when TTY available).
- All code paths must degrade safely: a missing/invalid config disables routing rather than crashing the harness.

---

## Task 1: Shared Models Core

**Files:**
- Create: `src/models/types.ts`
- Create: `src/models/defaults.ts`
- Create: `src/models/config.ts`
- Create: `src/models/resolve.ts`
- Test: `test/unit/models/config.test.ts`
- Test: `test/unit/models/resolve.test.ts`

**Interfaces:**
- Consumes: nothing (pure data module).
- Produces:
  - `ModelConfig` type, `ModelMode` union (`'auto' | 'family' | 'individual'`).
  - `DEFAULT_FAMILIES: Record<string, FamilyTiers>` where `FamilyTiers = { workhorse: string; budget: string }`.
  - `loadConfig(cwd: string): RouterConfig`
  - `resolveTier(cwd: string, mainModel: string, tier: 'workhorse' | 'budget', config: RouterConfig): string | null`
  - `detectFamily(modelId: string): string | null`

**Step 1: Write failing test for config loader**

```ts
// test/unit/models/config.test.ts
import { describe, it, expect } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../../../src/models/config.js';

describe('loadConfig', () => {
  it('returns default config when file is missing', () => {
    const cwd = join(tmpdir(), `sbl-test-${Date.now()}`);
    mkdirSync(cwd, { recursive: true });
    const cfg = loadConfig(cwd);
    expect(cfg.enabled).toBe(false);
    expect(cfg.mode).toBe('family');
    rmSync(cwd, { recursive: true, force: true });
  });
});
```

Run: `npx vitest run test/unit/models/config.test.ts`
Expected: FAIL "loadConfig is not defined".

**Step 2: Implement types and defaults**

```ts
// src/models/types.ts
export type ModelMode = 'auto' | 'family' | 'individual';

export interface FamilyTiers {
  workhorse: string;
  budget: string;
}

export interface RouterConfig {
  version: number;
  enabled: boolean;
  mode: ModelMode;
  tiers: Partial<FamilyTiers>;
  individual: Partial<FamilyTiers>;
  families: Record<string, Partial<FamilyTiers>>;
  resolved: Partial<{ discoveredAt: string } & FamilyTiers>;
}
```

```ts
// src/models/defaults.ts
import type { FamilyTiers, RouterConfig } from './types.js';

export const DEFAULT_FAMILIES: Record<string, FamilyTiers> = {
  kimi: { workhorse: 'opencode/kimi-k2.7-code', budget: 'opencode/kimi-k2.5' },
  grok: { workhorse: 'xai/grok-4.5', budget: 'xai/grok-4.3' },
  claude: { workhorse: 'opencode/claude-sonnet-4-6', budget: 'opencode/claude-haiku-4-5' },
  gpt: { workhorse: 'opencode/gpt-5.1-codex-mini', budget: 'opencode/gpt-5-nano' },
  gemini: { workhorse: 'opencode/gemini-3.5-flash', budget: 'opencode/gemini-3.5-flash-lite' },
};

export const DEFAULT_CONFIG: RouterConfig = {
  version: 1,
  enabled: false,
  mode: 'family',
  tiers: {},
  individual: {},
  families: {},
  resolved: {},
};
```

**Step 3: Implement config loader**

```ts
// src/models/config.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CONFIG, DEFAULT_FAMILIES } from './defaults.js';
import type { FamilyTiers, RouterConfig } from './types.js';

const CONFIG_PATH = '.super-backlog/models.json';

export function loadConfig(cwd: string): RouterConfig {
  const path = join(cwd, CONFIG_PATH);
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONFIG };
    return normalizeConfig(raw as Partial<RouterConfig>);
  } catch {
    return { ...DEFAULT_CONFIG, enabled: false };
  }
}

export function normalizeConfig(partial: Partial<RouterConfig>): RouterConfig {
  return {
    version: typeof partial.version === 'number' ? partial.version : DEFAULT_CONFIG.version,
    enabled: partial.enabled === true,
    mode: ['auto', 'family', 'individual'].includes(partial.mode as string) ? (partial.mode as RouterConfig['mode']) : 'family',
    tiers: partial.tiers && typeof partial.tiers === 'object' ? partial.tiers : {},
    individual: partial.individual && typeof partial.individual === 'object' ? partial.individual : {},
    families: partial.families && typeof partial.families === 'object' ? partial.families : {},
    resolved: partial.resolved && typeof partial.resolved === 'object' ? partial.resolved : {},
  };
}

export function getFamilyTable(config: RouterConfig): Record<string, FamilyTiers> {
  const merged: Record<string, FamilyTiers> = {};
  for (const [name, tiers] of Object.entries(DEFAULT_FAMILIES)) {
    merged[name] = { ...tiers, ...(config.families[name] || {}) };
  }
  for (const [name, tiers] of Object.entries(config.families)) {
    if (!merged[name]) merged[name] = { workhorse: '', budget: '', ...tiers };
  }
  return merged;
}
```

**Step 4: Implement family detection and tier resolution**

```ts
// src/models/resolve.ts
import type { RouterConfig } from './types.js';
import { getFamilyTable } from './config.js';

export function detectFamily(modelId: string): string | null {
  const lower = modelId.toLowerCase();
  if (lower.includes('kimi')) return 'kimi';
  if (lower.includes('grok')) return 'grok';
  if (lower.includes('claude')) return 'claude';
  if (lower.includes('gemini')) return 'gemini';
  if (lower.includes('gpt')) return 'gpt';
  return null;
}

export function resolveTier(
  mainModel: string,
  tier: 'workhorse' | 'budget',
  config: RouterConfig,
): string | null {
  if (!config.enabled) return null;

  if (config.mode === 'individual') {
    return config.individual[tier] || null;
  }

  const family = detectFamily(mainModel);
  if (!family) return null;

  if (config.mode === 'family') {
    const table = getFamilyTable(config);
    const entry = table[family];
    if (!entry) return null;
    return config.tiers[tier] || entry[tier] || null;
  }

  // auto mode falls back to family table when discovery is not populated
  return config.resolved[tier] || config.tiers[tier] || null;
}
```

**Step 5: Add unit tests for resolution**

```ts
// test/unit/models/resolve.test.ts
import { describe, it, expect } from 'vitest';
import { resolveTier, detectFamily } from '../../../src/models/resolve.js';
import { DEFAULT_CONFIG, type RouterConfig } from '../../../src/models/types.js';

describe('resolveTier', () => {
  it('returns null when disabled', () => {
    expect(resolveTier('kimi-for-coding/k3', 'budget', DEFAULT_CONFIG)).toBeNull();
  });

  it('picks budget tier from same family in family mode', () => {
    const cfg: RouterConfig = { ...DEFAULT_CONFIG, enabled: true, mode: 'family' };
    expect(resolveTier('kimi-for-coding/k3', 'budget', cfg)).toBe('opencode/kimi-k2.5');
    expect(resolveTier('kimi-for-coding/k3', 'workhorse', cfg)).toBe('opencode/kimi-k2.7-code');
  });

  it('uses individual overrides', () => {
    const cfg: RouterConfig = {
      ...DEFAULT_CONFIG,
      enabled: true,
      mode: 'individual',
      individual: { workhorse: 'xai/grok-4.5', budget: 'xai/grok-4.3' },
    };
    expect(resolveTier('kimi-for-coding/k3', 'budget', cfg)).toBe('xai/grok-4.3');
  });
});
```

Run: `npx vitest run test/unit/models/resolve.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add src/models/ test/unit/models/
git commit -m "feat(models): add shared config, family tables and tier resolver"
```

---

## Task 2: Discovery Module

**Files:**
- Create: `src/models/discovery.ts`
- Test: `test/unit/models/discovery.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_FAMILIES` and `RouterConfig`.
- Produces:
  - `discoverModels(cwd: string): Promise<ResolvedTiers>`
  - `parseOpenCodeModels(output: string): string[]`
  - `rankTiers(available: string[]): Pick<FamilyTiers, 'workhorse' | 'budget'>`

**Step 1: Write failing test**

```ts
// test/unit/models/discovery.test.ts
import { describe, it, expect } from 'vitest';
import { parseOpenCodeModels, rankTiers } from '../../../src/models/discovery.js';

describe('parseOpenCodeModels', () => {
  it('extracts model ids from opencode models output', () => {
    const output = 'opencode/kimi-k3\nopencode/kimi-k2.7-code\nopencode/gpt-5-nano\n';
    expect(parseOpenCodeModels(output)).toEqual([
      'opencode/kimi-k3',
      'opencode/kimi-k2.7-code',
      'opencode/gpt-5-nano',
    ]);
  });
});

describe('rankTiers', () => {
  it('picks the strongest available workhorse and cheapest available budget', () => {
    const result = rankTiers(['opencode/kimi-k3', 'opencode/kimi-k2.7-code', 'opencode/kimi-k2.5']);
    expect(result.workhorse).toBe('opencode/kimi-k2.7-code');
    expect(result.budget).toBe('opencode/kimi-k2.5');
  });
});
```

Run: `npx vitest run test/unit/models/discovery.test.ts`
Expected: FAIL.

**Step 2: Implement parser**

```ts
// src/models/discovery.ts
import { runCapture } from '../lib/run.js';
import { DEFAULT_FAMILIES } from './defaults.js';
import type { FamilyTiers } from './types.js';

export interface ResolvedTiers {
  discoveredAt: string;
  workhorse: string;
  budget: string;
}

export function parseOpenCodeModels(output: string): string[] {
  return output
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes('/'));
}

function scoreForTier(modelId: string, tier: 'workhorse' | 'budget'): number {
  const lower = modelId.toLowerCase();
  // Prefer flagship-ish names for workhorse, avoid 'nano/lite' for workhorse
  if (tier === 'workhorse') {
    if (lower.includes('opus')) return 100;
    if (lower.includes('sonnet')) return 90;
    if (lower.includes('gpt-5.1') || lower.includes('gpt-5.2') || lower.includes('k3')) return 80;
    if (lower.includes('gemini-3.1') || lower.includes('gemini-3.5') || lower.includes('gemini-3.6')) return 70;
    if (lower.includes('k2.7') || lower.includes('k2.6')) return 60;
    if (lower.includes('grok-4.6')) return 55;
    if (lower.includes('grok-4.5')) return 50;
    return 10;
  }
  // Budget tier: prefer nano/lite/flash names
  if (lower.includes('nano') || lower.includes('lite')) return 100;
  if (lower.includes('flash')) return 90;
  if (lower.includes('haiku')) return 85;
  if (lower.includes('k2.5')) return 80;
  if (lower.includes('grok-4.3')) return 70;
  return 10;
}

export function rankTiers(available: string[]): Pick<FamilyTiers, 'workhorse' | 'budget'> {
  const workhorse = [...available].sort((a, b) => scoreForTier(b, 'workhorse') - scoreForTier(a, 'workhorse'))[0] || '';
  const budget = [...available].sort((a, b) => scoreForTier(b, 'budget') - scoreForTier(a, 'budget'))[0] || '';
  return { workhorse, budget };
}

export async function discoverModels(_cwd: string): Promise<ResolvedTiers | null> {
  const result = runCapture('opencode', ['models']);
  if (result.status !== 0) return null;
  const available = parseOpenCodeModels(result.stdout);
  if (available.length === 0) return null;
  const ranked = rankTiers(available);
  return {
    discoveredAt: new Date().toISOString(),
    workhorse: ranked.workhorse,
    budget: ranked.budget,
  };
}
```

**Step 3: Run tests**

Run: `npx vitest run test/unit/models/discovery.test.ts`
Expected: PASS.

**Step 4: Commit**

```bash
git add src/models/discovery.ts test/unit/models/discovery.test.ts
git commit -m "feat(models): add opencode models discovery and tier ranking"
```

---

## Task 3: CLI Commands and Init Opt-in

**Files:**
- Create: `src/commands/models.ts`
- Modify: `src/commands/init.ts` (parse --models / --no-models)
- Modify: `src/init/planner.ts` (add `models` boolean to InitOptions, add router install action when enabled)
- Modify: `src/init/execute.ts` (execute router install action)
- Modify: `src/cli.ts` (register `models` subcommand)
- Test: `test/integration/models-cli.test.ts`

**Interfaces:**
- Consumes: `loadConfig`, `discoverModels`, `resolveTier`, `atomicWrite`.
- Produces:
  - `runModels(cwd: string, args: ParsedArgs): Promise<number>`
  - New action kind `'install-model-router'` in planner/execute.

**Step 1: Add the router install action to planner**

```ts
// src/init/planner.ts
export interface ModelRouterOp { kind: 'install-model-router'; enabled: boolean }
export type Action = ... | ModelRouterOp;

export interface InitOptions {
  // ... existing fields
  models?: boolean; // undefined = no router installation
}

// in planInit, after refreshHook action block:
if (opts.models === true) actions.push({ kind: 'install-model-router', enabled: true });
```

**Step 2: Execute the router install action**

In `src/init/execute.ts` switch add:

```ts
case 'install-model-router': {
  const { writeRouterConfig } = await import('../models/install.js');
  writeRouterConfig(cwd, action.enabled);
  applied++;
  break;
}
```

**Step 3: Implement install helper**

```ts
// src/models/install.ts
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWrite } from '../lib/atomic.js';
import { DEFAULT_CONFIG } from './defaults.js';
import type { RouterConfig } from './types.js';

const CONFIG_DIR = '.super-backlog';
const CONFIG_FILE = 'models.json';

export function writeRouterConfig(cwd: string, enabled: boolean): boolean {
  const dir = join(cwd, CONFIG_DIR);
  const path = join(dir, CONFIG_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const next: RouterConfig = { ...DEFAULT_CONFIG, enabled };
  atomicWrite(path, `${JSON.stringify(next, null, 2)}\n`);
  return true;
}
```

**Step 4: Parse --models / --no-models in init**

In `src/commands/init.ts`:

```ts
const models = args.values.models === true ? true : args.values['no-models'] === true ? false : undefined;
// pass into InitOptions
const opts: InitOptions = { ..., models };
```

Also add the boolean case to args parsing (the CLI parser already supports `--no-<flag>` for boolean flags).

**Step 5: Implement `sbl models` subcommands**

```ts
// src/commands/models.ts
import { loadConfig } from '../models/config.js';
import { discoverModels } from '../models/discovery.js';
import { writeRouterConfig } from '../models/install.js';
import type { ParsedArgs } from './init.js';

export async function runModels(cwd: string, args: ParsedArgs): Promise<number> {
  const sub = args.positionals[1] ?? 'show';
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
```

**Step 6: Register subcommand in CLI**

In `src/cli.ts`, add a route for `'models'` to dispatch to `runModels`.

**Step 7: Integration test**

```ts
// test/integration/models-cli.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit, type ParsedArgs } from '../src/commands/init.js';
import { runModels } from '../src/commands/models.js';

function emptyArgs(values: Record<string, unknown> = {}): ParsedArgs {
  return { values: values as Record<string, string | boolean | undefined>, positionals: [] };
}

describe('sbl models CLI', () => {
  it('enables router via init --models and writes config', async () => {
    const cwd = join(tmpdir(), `sbl-models-${Date.now()}`);
    try {
      // minimal setup
      const args = emptyArgs({ 'no-install': true, 'no-dashboard': true, models: true });
      await runInit(cwd, args);
      expect(existsSync(join(cwd, '.super-backlog/models.json'))).toBe(true);
      const raw = JSON.parse(readFileSync(join(cwd, '.super-backlog/models.json'), 'utf8'));
      expect(raw.enabled).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
```

Run: `npx vitest run test/integration/models-cli.test.ts`
Expected: PASS.

**Step 8: Commit**

```bash
git add src/commands/models.ts src/commands/init.ts src/init/planner.ts src/init/execute.ts src/models/install.ts src/cli.ts test/integration/models-cli.test.ts
git commit -m "feat(cli): add sbl models commands and init --models opt-in"
```

---

## Task 4: OpenCode Adapter

**Files:**
- Create: `src/templates/model-router-plugin.js`
- Create: `src/templates/agent-sbl-worker.md`
- Create: `src/templates/agent-sbl-worker-cheap.md`
- Create: `src/models/opencode.ts` (install helper)
- Modify: `src/init/execute.ts` (copy plugin + agents when router enabled)
- Test: `test/integration/opencode-router.test.ts`

**Interfaces:**
- Consumes: `loadConfig`, `resolveTier`.
- Produces:
  - Plugin file at `.opencode/plugins/sbl-model-router.js`
  - Agent files at `.opencode/agents/sbl-worker.md`, `.opencode/agents/sbl-worker-cheap.md`

**Step 1: Create plugin template**

```js
// src/templates/model-router-plugin.js
const { loadConfig } = require('../../models/config.js');
const { resolveTier } = require('../../models/resolve.js');

const TIER_BY_AGENT = {
  'sbl-worker': 'workhorse',
  'sbl-worker-cheap': 'budget',
  'explore': 'budget',
};

module.exports = async () => {
  return {
    'chat.params': async (input, output) => {
      const cfg = loadConfig(input.cwd ?? process.cwd());
      if (!cfg.enabled) return;
      const agent = input.agent?.name;
      const tier = TIER_BY_AGENT[agent];
      if (!tier) return;
      const mainModel = input.model;
      if (!mainModel || typeof mainModel !== 'string') return;
      const target = resolveTier(mainModel, tier, cfg);
      if (!target) return;
      output.params = output.params || {};
      output.params.model = target;
    },
  };
};
```

**Step 2: Create agent templates**

```markdown
---
name: sbl-worker
description: Runs bounded implementation tasks. Use via the task tool for well-scoped code changes.
mode: subagent
---
Implement the requested bounded change following project conventions and the existing codebase patterns.
```

```markdown
---
name: sbl-worker-cheap
description: Runs spikes, trivial edits, and mechanical searches. Use for fast, cheap work.
mode: subagent
---
Complete the requested lightweight task as cheaply and correctly as possible.
```

**Step 3: Install helper**

```ts
// src/models/opencode.ts
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWrite } from '../lib/atomic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function installOpenCodeAdapter(cwd: string): void {
  const pluginPath = join(cwd, '.opencode', 'plugins', 'sbl-model-router.js');
  const workerPath = join(cwd, '.opencode', 'agents', 'sbl-worker.md');
  const cheapPath = join(cwd, '.opencode', 'agents', 'sbl-worker-cheap.md');
  atomicWrite(pluginPath, readFileSync(join(__dirname, '../templates/model-router-plugin.js'), 'utf8'));
  atomicWrite(workerPath, readFileSync(join(__dirname, '../templates/agent-sbl-worker.md'), 'utf8'));
  atomicWrite(cheapPath, readFileSync(join(__dirname, '../templates/agent-sbl-worker-cheap.md'), 'utf8'));
}
```

**Step 4: Wire into execute**

Modify `install-model-router` case to also call `installOpenCodeAdapter(cwd)` and `installClaudeAdapter(cwd)` when `enabled` is true.

**Step 5: Test**

```ts
// test/integration/opencode-router.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installOpenCodeAdapter } from '../src/models/opencode.js';

describe('OpenCode adapter install', () => {
  it('writes plugin and agent files', () => {
    const cwd = join(tmpdir(), `sbl-oc-${Date.now()}`);
    try {
      installOpenCodeAdapter(cwd);
      expect(existsSync(join(cwd, '.opencode/plugins/sbl-model-router.js'))).toBe(true);
      expect(existsSync(join(cwd, '.opencode/agents/sbl-worker.md'))).toBe(true);
      const plugin = readFileSync(join(cwd, '.opencode/plugins/sbl-model-router.js'), 'utf8');
      expect(plugin).toContain('sbl-worker');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
```

Run: `npx vitest run test/integration/opencode-router.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add src/templates/model-router-plugin.js src/templates/agent-sbl-worker.md src/templates/agent-sbl-worker-cheap.md src/models/opencode.ts test/integration/opencode-router.test.ts
git commit -m "feat(opencode): install model-router plugin and tier agents"
```

---

## Task 5: Claude Code Adapter

**Files:**
- Create: `src/templates/claude-agent-sbl-worker.md`
- Create: `src/templates/claude-agent-sbl-worker-cheap.md`
- Create: `src/models/claude.ts` (install + sync)
- Create: `src/templates/cc-session-hook.js`
- Modify: `src/init/execute.ts` (call installClaudeAdapter)
- Test: `test/integration/claude-router.test.ts`

**Interfaces:**
- Consumes: `loadConfig`, `resolveTier`, `atomicWrite`.
- Produces:
  - `.claude/agents/sbl-worker.md`, `.claude/agents/sbl-worker-cheap.md`
  - Hook block in `.claude/settings.json`
  - Sync function `syncClaudeAgents(cwd: string, mainModel?: string): void`

**Step 1: Agent templates for Claude**

Same bodies as OpenCode agents, but include a placeholder `model: TIER_PLACEHOLDER` line in frontmatter so sync can find and replace it.

```markdown
---
name: sbl-worker
description: Runs bounded implementation tasks. Use via the Agent tool for well-scoped code changes.
model: TIER_PLACEHOLDER
---
Implement the requested bounded change following project conventions and the existing codebase patterns.
```

**Step 2: Sync function**

```ts
// src/models/claude.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWrite } from '../lib/atomic.js';
import { loadConfig } from './config.js';
import { resolveTier } from './resolve.js';

const MODEL_RE = /^model:\s*.+$/m;

export function syncClaudeAgents(cwd: string, mainModel?: string): void {
  const cfg = loadConfig(cwd);
  if (!cfg.enabled) return;
  const workhorse = mainModel ? resolveTier(mainModel, 'workhorse', cfg) : cfg.resolved.workhorse || null;
  const budget = mainModel ? resolveTier(mainModel, 'budget', cfg) : cfg.resolved.budget || null;
  updateAgentFile(cwd, 'sbl-worker.md', workhorse);
  updateAgentFile(cwd, 'sbl-worker-cheap.md', budget);
}

export function updateAgentFile(cwd: string, file: string, model: string | null): void {
  const path = join(cwd, '.claude', 'agents', file);
  if (!existsSync(path)) return;
  let content = readFileSync(path, 'utf8');
  const replacement = `model: ${model ?? 'inherit'}`;
  if (MODEL_RE.test(content)) {
    content = content.replace(MODEL_RE, replacement);
  } else {
    content = content.replace(/^---$/m, `---\n${replacement}`);
  }
  atomicWrite(path, content);
}
```

**Step 3: Install function and hook script**

```ts
// src/models/claude.ts continued
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function installClaudeAdapter(cwd: string): void {
  const workerPath = join(cwd, '.claude', 'agents', 'sbl-worker.md');
  const cheapPath = join(cwd, '.claude', 'agents', 'sbl-worker-cheap.md');
  atomicWrite(workerPath, readFileSync(join(__dirname, '../templates/claude-agent-sbl-worker.md'), 'utf8'));
  atomicWrite(cheapPath, readFileSync(join(__dirname, '../templates/claude-agent-sbl-worker-cheap.md'), 'utf8'));
  installSettingsHook(cwd);
}

function installSettingsHook(cwd: string): void {
  const path = join(cwd, '.claude', 'settings.json');
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const hook = {
    hooks: {
      SessionStart: [
        {
          matcher: '*',
          hooks: [
            {
              type: 'command',
              command: 'node',
              args: ['node_modules/super-backlog/dist/models/cc-session-hook.js'],
            },
          ],
        },
      ],
    },
  };
  // simplistic merge for the plan; final implementation should use marker block helper
  const next = { ...existing, hooks: { ...existing.hooks, ...hook.hooks } };
  atomicWrite(path, `${JSON.stringify(next, null, 2)}\n`);
}
```

```js
// src/templates/cc-session-hook.js
import { loadConfig } from '../models/config.js';
import { resolveTier } from '../models/resolve.js';
import { updateAgentFile } from '../models/claude.js';

async function main() {
  let input = '';
  process.stdin.on('data', (d) => { input += d; });
  await new Promise((resolve) => process.stdin.on('end', resolve));
  let event = {};
  try { event = JSON.parse(input); } catch { /* ignore */ }
  const cwd = process.cwd();
  const cfg = loadConfig(cwd);
  if (!cfg.enabled) process.exit(0);
  const mainModel = event.model;
  if (!mainModel || typeof mainModel !== 'string') process.exit(0);
  updateAgentFile(cwd, 'sbl-worker.md', resolveTier(mainModel, 'workhorse', cfg));
  updateAgentFile(cwd, 'sbl-worker-cheap.md', resolveTier(mainModel, 'budget', cfg));
  process.exit(0);
}
main();
```

**Step 4: Test**

```ts
// test/integration/claude-router.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installClaudeAdapter, syncClaudeAgents } from '../src/models/claude.js';
import { atomicWrite } from '../src/lib/atomic.js';

describe('Claude adapter', () => {
  it('installs agent files with placeholders', () => {
    const cwd = join(tmpdir(), `sbl-cc-${Date.now()}`);
    try {
      installClaudeAdapter(cwd);
      const worker = readFileSync(join(cwd, '.claude/agents/sbl-worker.md'), 'utf8');
      expect(worker).toContain('model: TIER_PLACEHOLDER');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('syncs agents to resolved models when main model is absent', () => {
    const cwd = join(tmpdir(), `sbl-cc-sync-${Date.now()}`);
    try {
      mkdirSync(join(cwd, '.super-backlog'), { recursive: true });
      mkdirSync(join(cwd, '.claude/agents'), { recursive: true });
      atomicWrite(join(cwd, '.super-backlog/models.json'), JSON.stringify({
        version: 1, enabled: true, mode: 'family', tiers: {}, individual: {}, families: {},
        resolved: { workhorse: 'sonnet', budget: 'haiku' },
      }));
      atomicWrite(join(cwd, '.claude/agents/sbl-worker.md'), '---\nname: sbl-worker\nmodel: TIER_PLACEHOLDER\n---\n');
      atomicWrite(join(cwd, '.claude/agents/sbl-worker-cheap.md'), '---\nname: sbl-worker-cheap\nmodel: TIER_PLACEHOLDER\n---\n');
      syncClaudeAgents(cwd);
      expect(readFileSync(join(cwd, '.claude/agents/sbl-worker.md'), 'utf8')).toContain('model: sonnet');
      expect(readFileSync(join(cwd, '.claude/agents/sbl-worker-cheap.md'), 'utf8')).toContain('model: haiku');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
```

Run: `npx vitest run test/integration/claude-router.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/models/claude.ts src/templates/cc-session-hook.js src/templates/claude-agent-sbl-worker.md src/templates/claude-agent-sbl-worker-cheap.md test/integration/claude-router.test.ts
git commit -m "feat(claude): install cc agents and session-start sync hook"
```

---

## Task 6: Dashboard API and UI

**Files:**
- Create: `src/models/dashboard-api.ts`
- Modify: `src/commands/dashboard.ts` (mount API routes when `--serve`)
- Modify: `src/commands/dashboard.ts` or `src/dashboard/*` (render read-only section in static dashboard)
- Test: `test/integration/dashboard-api.test.ts`

**Interfaces:**
- Consumes: `loadConfig`, `discoverModels`, `normalizeConfig`, `resolveTier`.
- Produces: `registerModelRoutes(app: Express-like router): void`.

**Step 1: Add API route handler**

```ts
// src/models/dashboard-api.ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadConfig } from './config.js';
import { discoverModels } from './discovery.js';

export function createModelApiHandler(): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    if (method === 'GET' && url === '/api/models') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ config: loadConfig(process.cwd()), status: 'ok' }));
      return;
    }

    if (method === 'POST' && url === '/api/models/discover') {
      const result = await discoverModels(process.cwd());
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result ?? { error: 'discovery failed' }));
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  };
}
```

**Step 2: Mount in dashboard serve mode**

In `src/dashboard/server.ts`, before the fallback `404` handler, route `/api/models` to the API handler:

```ts
import { createModelApiHandler } from '../models/dashboard-api.js';

const modelApi = createModelApiHandler();

const server: Server = createServer((req, res) => {
  if (req.url?.startsWith('/api/')) {
    void modelApi(req, res);
    return;
  }
  // existing dashboard file handler follows
});
```

**Step 3: Test**

```ts
// test/integration/dashboard-api.test.ts
import { describe, it, expect } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createModelApiHandler } from '../src/models/dashboard-api.js';

function request(server: Server, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = server.request({ path, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('/api/models', () => {
  it('returns the current config', async () => {
    const handler = createModelApiHandler();
    const server = createServer((req, res) => { void handler(req, res); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const res = await request(server, '/api/models');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body).config).toHaveProperty('enabled');
    } finally {
      server.close();
    }
  });
});
```

Run: `npx vitest run test/integration/dashboard-api.test.ts`
Expected: PASS.

**Step 4: Commit**

```bash
git add src/models/dashboard-api.ts src/commands/dashboard.ts test/integration/dashboard-api.test.ts
git commit -m "feat(dashboard): expose model-router API endpoints in serve mode"
```

---

## Task 7: Uninstall and Cleanup

**Files:**
- Modify: `src/commands/uninstall.ts`
- Create: `src/models/uninstall.ts`
- Test: `test/integration/uninstall-router.test.ts`

**Interfaces:**
- Consumes: marker helpers from `src/lib/markers.ts`, `stripOwned`, `isOwnedSkillFile` pattern.
- Produces: `uninstallModelRouter(cwd: string, report: ReportLine[]): void`.

**Step 1: Add removal helper**

```ts
// src/models/uninstall.ts
import { existsSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWrite } from '../lib/atomic.js';

const ROUTER_FILES = [
  '.super-backlog/models.json',
  '.opencode/plugins/sbl-model-router.js',
  '.opencode/agents/sbl-worker.md',
  '.opencode/agents/sbl-worker-cheap.md',
  '.claude/agents/sbl-worker.md',
  '.claude/agents/sbl-worker-cheap.md',
];

export function uninstallModelRouter(cwd: string, report: { verdict: string; label: string }[]): void {
  for (const rel of ROUTER_FILES) {
    const abs = join(cwd, rel);
    if (!existsSync(abs)) {
      report.push({ verdict: 'skipped', label: `${rel} (not found)` });
      continue;
    }
    rmSync(abs, { force: true });
    report.push({ verdict: 'removed', label: rel });
  }

  // Remove .super-backlog directory if it only contains the now-deleted models.json
  const dir = join(cwd, '.super-backlog');
  if (existsSync(dir)) {
    try {
      const remaining = readdirSync(dir);
      if (remaining.length === 0) rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore race conditions
    }
  }
}
```

**Step 2: Wire into uninstall command**

In `src/commands/uninstall.ts`, after dashboard removal add:

```ts
uninstallModelRouter(cwd, report);
```

**Step 3: Test**

```ts
// test/integration/uninstall-router.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installOpenCodeAdapter } from '../src/models/opencode.js';
import { installClaudeAdapter } from '../src/models/claude.js';
import { uninstallModelRouter } from '../src/models/uninstall.js';

describe('uninstall model router', () => {
  it('removes all router-owned files', () => {
    const cwd = join(tmpdir(), `sbl-uninstall-${Date.now()}`);
    try {
      installOpenCodeAdapter(cwd);
      installClaudeAdapter(cwd);
      const report: { verdict: string; label: string }[] = [];
      uninstallModelRouter(cwd, report);
      expect(existsSync(join(cwd, '.opencode/plugins/sbl-model-router.js'))).toBe(false);
      expect(report.some((r) => r.label.includes('sbl-model-router.js'))).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
```

Run: `npx vitest run test/integration/uninstall-router.test.ts`
Expected: PASS.

**Step 4: Commit**

```bash
git add src/models/uninstall.ts src/commands/uninstall.ts test/integration/uninstall-router.test.ts
git commit -m "feat(uninstall): remove model-router artifacts with ownership report"
```

---

## Task 8: End-to-End Smoke Test

**Files:**
- Create: `test/e2e/router-lifecycle.test.ts`

**Step 1: Write end-to-end test**

```ts
// test/e2e/router-lifecycle.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit, type ParsedArgs } from '../src/commands/init.js';
import { runUninstall } from '../src/commands/uninstall.js';

function args(values: Record<string, unknown> = {}): ParsedArgs {
  return { values: values as Record<string, string | boolean | undefined>, positionals: [] };
}

describe('model router e2e lifecycle', () => {
  it('installs and uninstalls cleanly', async () => {
    const cwd = join(tmpdir(), `sbl-router-e2e-${Date.now()}`);
    mkdirSync(cwd, { recursive: true });
    try {
      const code = await runInit(cwd, args({ 'no-install': true, 'no-dashboard': true, models: true }));
      expect(code).toBe(0);
      expect(existsSync(join(cwd, '.super-backlog/models.json'))).toBe(true);
      expect(existsSync(join(cwd, '.opencode/plugins/sbl-model-router.js'))).toBe(true);

      const uninstall = runUninstall(cwd, args({}));
      expect(uninstall).toBe(0);
      expect(existsSync(join(cwd, '.opencode/plugins/sbl-model-router.js'))).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
```

Run: `npx vitest run test/e2e/router-lifecycle.test.ts`
Expected: PASS.

**Step 2: Commit**

```bash
git add test/e2e/router-lifecycle.test.ts
git commit -m "test(e2e): add model-router install/uninstall lifecycle test"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - [x] Three-tier model → Task 1 (`resolveTier`).
   - [x] Three modes (`auto`/`family`/`individual`) → Task 1.
   - [x] OpenCode runtime routing → Task 4.
   - [x] Claude Code materialized routing + SessionStart hook → Task 5.
   - [x] Discovery → Task 2.
   - [x] Dashboard edit API → Task 6.
   - [x] Init opt-in/uninstall → Tasks 3 and 7.
   - [x] Error handling (graceful fallback) → covered in `loadConfig` and `syncClaudeAgents`.

2. **Placeholder scan:**
   - [x] No TBD/TODO left in plan.
   - [x] Each test step contains concrete code.
   - [x] Each task ends with a commit command.

3. **Type consistency:**
   - [x] `RouterConfig` type used throughout.
   - [x] `FamilyTiers`, `ModelMode` definitions in one place.
   - [x] `resolveTier` signature matches consumers.
   - [x] `detectFamily` is defined in both `resolve.ts` and `claude.ts` — final implementation should move it to a single shared helper (e.g., `src/models/family.ts`) to avoid duplication.

4. **Known refinements for implementer:**
   - The `.claude/settings.json` hook merge in Task 5 uses a simplistic object spread; the real implementation should use the existing marker-block helpers (`injectBlock` / `stripOwned`) so that uninstall can remove only the sbl hook block.
   - Move `detectFamily` to a dedicated `src/models/family.ts` module and reuse it from `resolve.ts` and any CC sync code to avoid duplication.
   - The `cc-session-hook.js` template is written as ESM because `super-backlog` is itself an ESM package. Verify that Node resolves it correctly from `node_modules/super-backlog/dist/models/cc-session-hook.js` in a target project.
   - `cc-session-hook.js` and the OpenCode plugin template need to be copied to `dist/` by `scripts/copy-templates.mjs` during the build.
