# Floorplan Integration: Replace the Curated Architecture Layer — Design Spec

- **Date:** 2026-11-28
- **Status:** Design approved in the brainstorming session of 2026-11-28
- **Scope:** Remove super-backlog's own architecture map (`backlog/docs/architecture.yml`, its schema, layout engine, drift check and the `architecture-summary` skill) and point projects to [Floorplan](https://github.com/haydenschmitty/floorplan) instead; keep a slim facts page; serve an existing Floorplan map from the dashboard hub
- **Supersedes:** [Summary drift](2026-10-10-summary-drift-design.md) and [Summary hardening](2026-10-11-summary-hardening-design.md) in full; the diagram, flow and highlight parts of the summary page design. Both specs stay as history
- **Release:** `feat`, planned as 1.11.0. Needs release approval before it reaches `master`

## Problem

Since 1.6 super-backlog ships its own architecture map: an agent curates `backlog/docs/architecture.yml`, the hub lays it out as a diagram on the summary page, and `sbl summary` / `sbl doctor` check the file for drift. That is about 2,100 source lines (schema, layout engine, drift check, renderer, skill) plus about 2,500 test lines for a job that is not the core of a workflow kit.

Floorplan (MIT, v0.11.0, zero dependencies, Node >= 18) does the same job with far more depth: it scans the code, resolves imports and HTTP routes, lets the agent name subsystems, and builds an interactive map with flows, a tour, a health check and an Ask bar. The user asked to integrate Floorplan in place of the own implementation.

## What the evaluation found

Floorplan was installed at user scope and run in this repo (checksums verified against the release: 61 files identical).

| Finding | Consequence |
|---|---|
| Not an npm package. Distributed only as a Claude Code and a Codex plugin | It cannot become a dependency of `sbl`. super-backlog references it, it does not bundle it |
| No OpenCode support | OpenCode users lose the map. Accepted |
| The map lives in `floorplan/` with a self-ignoring `.gitignore` (`*`); it is personal per clone and never committed | A CI drift check has no basis any more. Accepted |
| It covers code structure only, not version, lines of code, tests, releases, CI or open tasks | The summary page keeps its automatic facts |
| `floorplan/index.html` is one self-contained file (2.2 MB here): all scripts inline and pinned by hash in a `<meta>` content security policy, `default-src 'none'`, no external requests | The hub can serve it as a plain static file |
| Every call to Floorplan's own server is guarded by `window.FLOORPLAN_SERVER`, which only that server injects | Served by the hub, the map renders completely; only the Ask bar and saving flows are off, and the page itself says to run `node floorplan/serve.mjs` for them |
| `floorplan/graph.json` carries `meta.generatedAt`, `meta.counts.files`, the node list and `meta.repos[].head` (the commit the map was built at) | `sbl` can report whether a map exists and how far `HEAD` has moved, without calling any Floorplan script |
| In its normal flow Floorplan may add a section to `CLAUDE.local.md` and an entry to `.git/info/exclude`, both on consent | Not our files. `sbl uninstall` does not touch them or `floorplan/` |

Spike result, measured: the page served from `/p/super-backlog/map/` by a plain static server produced one request (the page), no console messages and a working board with search, tour and flows menu.

## Rejected alternatives

- **Vendor the Floorplan skill into the npm package.** 1.6 MB of third-party code from a young, fast-moving project; every Floorplan release would need a super-backlog release, and the plugin already has its own update channel.
- **Keep `architecture.yml` and convert it to `architecture.json`.** Two formats to keep in step, and the conversion is lossy in both directions (zones and highlights on one side, file assignment by glob on the other).
- **Start Floorplan's server from the hub.** `sbl` would run third-party scripts with the user's agent credentials (the Ask bar runs `claude -p` or `codex exec`). The hub only serves the already built page.
- **Remove `sbl summary` (breaking, 2.0.0).** A stub that exits 0 keeps existing scripts working.

## Decisions

### 1. What is removed

- `src/dashboard/summary-schema.ts`, `summary-layout.ts`, `summary-drift.ts` and their unit tests (`summary-schema`, `summary-layout`, `summary-drift`, `summary-client`).
- The diagram, flows, highlights, legend, side panel and drift notice in `src/templates/summary.html` and `src/dashboard/summary-render.ts`, including every code path that reads `backlog/docs/architecture.yml`.
- `src/templates/skill-architecture-summary.md`; `architecture-summary` leaves `GLUE_SKILLS` in `src/init/execute.ts`.
- Doctor check 5 in its current form (file validity, layout warnings, drift).
- The repo's own `backlog/docs/architecture.yml`.

`src/dashboard/summary-facts.ts` and `src/lib/yamlmini.ts` stay; `yamlmini` is still used by `src/dashboard/data.ts` and `src/lib/slug.ts`.

### 2. The summary page becomes a facts page

The page at `/p/<slug>/summary/` shows what today's reduced view shows: name, version and license, lines of code and test files, releases, CI workflows, open tasks, commands from the manifest and the tech stack from the manifests. The notice that explains how to add the curated file is gone.

A new **Code map** card sits above the open tasks:

- Map present: "Floorplan map, built `<date>`, `<n>` files, `<m>` parts" and a link **Open map** to `../map/`. When `HEAD` has moved since the map was built: "`<k>` commits since".
- No map: one sentence that Floorplan draws an interactive map of the codebase, the two install commands for Claude Code, the request to give the agent ("make a floorplan"), and a link to the Floorplan repository. No error styling: a missing map is a normal state.
- Map unreadable: one neutral line "Floorplan map unreadable" with the reason.

The **Data source** section at the bottom names the manifests, git, the backlog and, when present, `floorplan/graph.json`.

### 3. One reader for the map status

A new module `src/lib/floorplan.ts` holds the only code that knows Floorplan's file layout:

```ts
export const FLOORPLAN_DIR = 'floorplan';
export const FLOORPLAN_REPO_URL = 'https://github.com/haydenschmitty/floorplan';
export const FLOORPLAN_INSTALL_COMMANDS = [
  'claude plugin marketplace add haydenschmitty/floorplan',
  'claude plugin install floorplan@floorplan',
] as const;

export type FloorplanStatus =
  | { state: 'missing' }
  | { state: 'invalid'; reason: string }
  | { state: 'map'; builtAt: string; files: number; nodes: number; commitsSince: number | null };

export function readFloorplanStatus(cwd: string, deps?: FloorplanDeps): FloorplanStatus;
export function floorplanPagePath(cwd: string): string; // <cwd>/floorplan/index.html
export function floorplanStatusLine(status: FloorplanStatus): string; // shared by doctor and sbl summary
```

- `missing`: `floorplan/graph.json` or `floorplan/index.html` does not exist.
- `invalid`: `graph.json` is larger than 10 MB, is not JSON, or lacks a string `meta.generatedAt` that parses as a date.
- `map`: `builtAt` from `meta.generatedAt`; `files` from `meta.counts.files` (0 when absent or not a number); `nodes` from the length of `nodes` (0 when absent). `commitsSince` is the output of `git rev-list --count <head>..HEAD` for the entry in `meta.repos` whose `path` is `.`; it is `null` when there is no such entry, the head is not a 40-character hex string, or git fails (for example after a rebase removed the commit).
- The reader never executes anything from `floorplan/` and never follows the content of `graph.json` to other paths. git runs through the existing `run` seam with an argument array.

### 4. The hub serves the map

`src/dashboard/hub.ts` gets two routes next to the summary routes:

- `/p/<slug>/map` redirects (302) to `/p/<slug>/map/`.
- `GET /p/<slug>/map/` and `/p/<slug>/map/index.html` send `<project>/floorplan/index.html` with `content-type: text/html; charset=utf-8` and `cache-control: no-store`. When the file is missing the answer is 404 with the text `no floorplan map - install the Floorplan plugin and ask your agent to make a floorplan`.

The response carries an additional header `Content-Security-Policy: connect-src 'none'; form-action 'none'; base-uri 'none'`. Browsers apply it together with the page's own `<meta>` policy and the stricter rule wins, so a map served by the hub cannot send requests to the hub's own API. It is the same connection rule Floorplan uses for exported copies.

The hub serves exactly this one file. No other path under `floorplan/` is reachable, and the hub does not start, stop or talk to Floorplan's server. The map is not regenerated or watched by the hub; a browser reload shows a rebuilt map.

`sbl dashboard --out <file>` (the static export) does not copy the map; the Code map card then shows the status without the link.

### 5. `sbl doctor` check 5

Check 5 keeps its position and reports the map:

| State | Status | Line |
|---|---|---|
| `missing` | `skip` | `no floorplan map (optional: install the Floorplan plugin and ask your agent to make a floorplan)` |
| `invalid` | `warn` | `floorplan/graph.json unreadable (<reason>)` with detail `fix: ask your agent to update the floorplan` |
| `map`, `commitsSince` 0 | `ok` | `floorplan map current (built <date>, <n> files, <m> parts)` |
| `map`, `commitsSince` > 0 | `ok` | `floorplan map built <date>, <k> commits behind HEAD (<n> files, <m> parts)` |
| `map`, `commitsSince` null | `ok` | `floorplan map built <date> (<n> files, <m> parts)` |

A map that is behind `HEAD` is `ok`, not `warn`: the map is optional and personal, most commits do not change structure, and `warn` would turn the exit code of `sbl doctor` to 4 after every commit.

Directly after it, when `backlog/docs/architecture.yml` still exists: `skip` with `backlog/docs/architecture.yml is no longer used (Floorplan replaces it; safe to delete)`. super-backlog never deletes the file in user projects.

### 6. `sbl summary` becomes a stub

`sbl summary` prints the following with any arguments and exits 0:

```text
sbl summary no longer checks backlog/docs/architecture.yml: the curated architecture file was replaced by Floorplan (https://github.com/haydenschmitty/floorplan).
map status: <the line from the check 5 table, without the status prefix>
```

`--check`, `--json` and other old options are accepted and ignored. Outside a super-backlog project the second line is omitted. The help text of `sbl` lists the command as `summary     Deprecated: prints the Floorplan map status` and drops the `summary options:` block. `src/commands/summary.ts` shrinks to this stub; its unit and integration tests are rewritten for the new contract.

### 7. Templates, init, update and uninstall

- `src/templates/workflow-block.md`, rule 7 becomes:

  > 7. Keep the code map current — if the project has a Floorplan map (`floorplan/` exists) and a merge changed the structure (new, moved or removed modules), update the floorplan with the Floorplan skill before the final report, or say in the report that the map is stale when the skill is not available. Never create a map unasked.

  Rule 8 (the three gates) is unchanged: updating an existing map is not a checkpoint.
- `src/templates/skill-backlog-status-report.md` and `skill-task-review-gate.md` lose their references to the architecture file and to `sbl summary`.
- `sbl init`: `INIT_SUMMARY_HINT` is replaced by `INIT_FLOORPLAN_HINT`, printed when `readFloorplanStatus` returns `missing` and `claude` is among the selected harnesses: `next step (optional): install the Floorplan plugin for an interactive code map (claude plugin marketplace add haydenschmitty/floorplan; claude plugin install floorplan@floorplan), then ask your agent to make a floorplan`. `sbl init` does not install the plugin itself and does not probe the user's plugin directory.
- `sbl update` removes the installed skill directories `.claude/skills/architecture-summary` and `.opencode/skill/architecture-summary` when present and reports `removed legacy <path>`, the same way the `project-profile` skill was removed in 1.10.
- `src/commands/uninstall.ts` keeps both paths in `OWNED_SKILL_DIRS` so that older installs are still cleaned up. It does not touch `floorplan/`, `CLAUDE.local.md` or `.git/info/exclude`.

### 8. Docs and dogfood

- `docs/guide/project-summary.md` is rewritten: what the facts page shows, the Code map card, how to get a map (install, "make a floorplan", "update the floorplan"), what the hub serves and what needs Floorplan's own server (`node floorplan/serve.mjs` for the Ask bar), the note that the map is personal and not committed, and a migration section for projects that have `backlog/docs/architecture.yml`.
- `README.md`, `docs/guide/quickstart.md` and `docs/guide/harness-support.md` replace their architecture-file sentences; harness support states that the code map needs Claude Code or Codex.
- `docs/assets/project-summary.png` is retaken.
- The managed files of this repo (`AGENTS.md`, `CLAUDE.md`, `.claude/skills/*`) are refreshed with `node dist/bin.js update --no-self`, never edited by hand.

## Error handling

- `readFloorplanStatus` never throws: every read, parse and git failure maps to `missing`, `invalid` or `commitsSince: null`.
- The summary page renders the "no map" card for `missing` and the neutral line for `invalid`; a broken map never fails the page generation.
- The hub answers a vanished map file with 404.

## Security

- Third-party content: `floorplan/index.html` is generated by a plugin the user installed, from the user's own repository. The hub adds a response policy that forbids network requests, so the page cannot call hub endpoints even though it shares the origin. Scripts in the page are already pinned by hash through its own policy.
- Path handling: the served path is fixed (`floorplan/index.html` below the registered project root); no request input becomes part of a file path.
- `graph.json` is read with a size limit and only four fields are used; values are escaped like every other value on the summary page.
- `sbl` never runs Floorplan scripts and never sends anything to Floorplan Cloud. The hints name the plugin; whether to install it is the user's decision.

## Testing

- `test/unit/floorplan.test.ts`: every state of `readFloorplanStatus` (no folder, page without graph, oversized file, broken JSON, missing date, map with and without matching repo entry, git failure, a non-hex head never reaches git) and every row of `floorplanStatusLine`.
- `test/unit/doctor.test.ts`: the five rows of the check 5 table and the legacy-file line; the exit code stays 0 for a map behind `HEAD`.
- `test/unit/summary-command.test.ts`, `test/integration/summary-cli.test.ts`: stub output, exit 0 with old flags, outside a project.
- `test/unit/summary-render.test.ts` and its snapshot: facts page with map, without map and with an unreadable map, escaped values, no trace of the diagram markup.
- `test/unit/hub.test.ts`, `test/integration/serve.test.ts`: redirect, 200 with the three headers, 404 without map, no other file under `floorplan/` reachable.
- `test/unit/templates.test.ts`, `glue-skills.test.ts`, `test/e2e/{init,doctor,uninstall}.e2e.test.ts`, `test/docs.test.ts`: skill list, rule 7 wording, init hint, legacy skill removal on update, docs references.
- Full verification before the PR: `npm run build && npm test && npm run lint && npx tsc --noEmit` and `npx vitepress build docs`.

## Out of scope

- A Floorplan integration for OpenCode.
- Starting or embedding Floorplan's server, the Ask bar inside the hub, live reload of the map.
- Converting an existing `architecture.yml` into a Floorplan map.
- A CI check for map freshness.
