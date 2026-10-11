# Router v2 hardening (deferred review findings) - implementation plan

Base: fresh branch `fix/router-v2-hardening` off origin/master after PR #88 is merged.
One backlog task (8 acceptance criteria), one PR. Test-first for every item.
`src/models/` is a critical area (top tier); the uninstall change (item 4) gets an
independent review by a separate Opus subagent before the PR.

## 1. UTF-8 BOM in models.json (src/models/config.ts, src/models/apply.ts)
- New internal `readConfigFile(path)`: reads, strips a leading `﻿`, parses,
  throws `InvalidConfigError` on bad JSON. `loadConfig` (catch -> defaults),
  `readConfigStrict` (rethrow) and `migrateFile` (catch -> warning) all use it.
- `migrateFile` compares without the BOM, so a BOM alone causes no rewrite.
- Tests: BOM file loads in loadConfig / readConfigStrict; `sbl update` path does
  not warn and does not rewrite a normalized BOM file.

## 2. Unknown higher version (config.ts)
- `version` is a number > 2 -> `UnsupportedConfigVersionError extends InvalidConfigError`,
  message `.super-backlog/models.json has version 3, which this super-backlog does not support - left unchanged; upgrade super-backlog or delete it`.
- Thrown by `readConfigFile`, so: loadConfig -> defaults, write paths refuse
  (exit 1 / dashboard failed), migrateFile warns and never writes.
  Version 1, missing or non-numeric version stays v1 migration.
- Tests: v3 file is not rewritten by set/enable/update; loadConfig returns defaults.

## 3. atomicWrite Windows fallback (src/lib/atomic.ts)
- On a failed rename: if the target exists, rename it to `<file>.bak`, rename tmp
  over; if that fails, rename the backup back, remove tmp, rethrow; on success
  remove the backup. No target: retry once, remove tmp on failure.
- Tests (vi.mock of node:fs renameSync): second rename fails -> target content
  intact, no .tmp/.bak left, error thrown; normal fallback still replaces.

## 4. Single-string SessionStart hook (src/models/uninstall.ts)
- `isOwnedHook` also accepts `{type:'command', command:'node <path>'}` (optional
  node.exe, optional quotes, backslashes) where <path> matches the existing
  OWNED_HOOK_RE. Anything else (extra args, other commands) stays foreign.
- Tests: cleanLegacy and uninstallModelRouter remove the string form; a foreign
  string command and `node <ours> --x` stay.

## 5. One invalid-models.json message
- migrateFile reports `warning: ${err.message}` from the shared error, so update,
  init and `sbl models` all say "... left unchanged; fix or delete it".
- Test: update-path warning equals the InvalidConfigError message.

## 6. `sbl models discover` validates first (src/commands/models.ts, dashboard-api.ts)
- `readConfigStrict(cwd)` before `discoverModels`; same in the dashboard discover
  endpoint (500 + message, discovery not called).
- Tests: injected/mocked discovery is never called with an invalid config.

## 7. `sbl models show` warns (src/commands/models.ts)
- On InvalidConfigError print `warning: <message>` to stderr, then the defaults; exit 0.
- Test: stderr carries the warning, stdout the default config.

## 8. Docs (docs/guide/model-router.md)
- Dashboard section: the enable toggle does what `sbl models enable` does,
  including installing the agents for both harnesses.
- Errors section: BOM accepted, unsupported version, discover/show behavior.

## Verification
`npm test`, `npm run lint`, `npx vitepress build docs` green; `sbl phase` at each gate;
PR against master (no push to master).
