# Router v2 — Four Tiers in the Model Router — Design Spec

- **Date:** 2026-10-11
- **Status:** Decided autonomously on 2026-10-11 under the user's standing go-ahead ("follow your own recommendations"); no section-by-section review
- **Scope:** `.super-backlog/models.json` version 2 with the four tiers Light / Standard / Strong / Top per harness, one subagent per tier for Claude Code and OpenCode, four-tier discovery for OpenCode, `sbl update` maintaining router files, the managed block's example lines rendered from the configuration, closing the `TIER_PLACEHOLDER` gap, removal of the SessionStart hook and the OpenCode plugin
- **Builds on:** [Model tiers and project profile design](2026-10-10-model-tiers-and-project-profile-design.md) (the four tiers and the examples block, "Out of scope" names this spec), [SBL model router plan](../plans/2026-08-26-sbl-model-router.md) (router v1), [Models modal design](2026-08-29-models-modal-design.md)

## Problem

The managed block speaks of four tiers. The router knows two (`workhorse`, `budget`), and its configuration cannot express the other two.

The block's example lines are static text, so a project that configured its router still reads the release's generic examples.

Router v1 writes `model: TIER_PLACEHOLDER` into `.claude/agents/sbl-worker*.md` and relies on a SessionStart hook to replace it. Until the first hook run, and forever while the router is disabled, the agent file names an invalid model.

`sbl update` never touches router files, so router fixes never reach installed projects.

Router v1 follows the session model's *family* (kimi, grok, claude, gpt, gemini) through a hard-coded table of OpenCode ids. The table ages with every model release, and the Claude Code agents receive OpenCode ids (`opencode/claude-sonnet-4-6`) that Claude Code does not understand.

## Rejected alternatives

- **Keep family following, widen the table to four tiers.** Five families times four tiers of hard-coded ids that go stale; the Claude Code side stays wrong. The user picks models per tier once; discovery helps on OpenCode.
- **Keep the SessionStart hook and the OpenCode plugin, drive them from four tiers.** Both exist only to resolve a model at runtime. With static per-tier models, writing the model into the agent file at install and update time is simpler, has no runtime failure mode, and closes the placeholder gap by construction.
- **Render the block examples only on `sbl update`.** The `sbl models` commands change the configuration; leaving the block stale until the next update reintroduces the drift this spec removes. Every command that changes the configuration re-renders the block.
- **Install router agents on `sbl update` whenever `models.json` exists.** `update` maintains what is installed; it does not install new files. Installation stays with `sbl init --models` and `sbl models enable`.
- **Let the dashboard edit tiers.** A form for eight free-text model ids for a rarely used setting. The modal shows the tiers and names the CLI command.

## Decisions

### Configuration — `.super-backlog/models.json` version 2

```json
{
  "version": 2,
  "enabled": true,
  "tiers": {
    "claude": { "light": "haiku", "standard": "sonnet", "strong": "opus", "top": "fable" },
    "opencode": { "light": "opencode/gemini-3.5-flash-lite", "standard": "opencode/claude-sonnet-4-6" }
  },
  "discoveredAt": "2026-10-11T08:00:00.000Z"
}
```

- Tier names: `light`, `standard`, `strong`, `top`. Harness keys: `claude`, `opencode`.
- Every tier entry is optional. A missing Claude tier falls back to the built-in Claude default. A missing OpenCode tier has no default: the agent gets no `model` line and OpenCode uses the session model.
- Built-in Claude defaults: light `haiku`, standard `sonnet`, strong `opus`, top `fable`. These are Claude Code aliases, valid both as the Agent tool's `model` parameter and in agent frontmatter.
- A model id must match `^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$` and be at most 100 characters. Ids are written into YAML frontmatter and Markdown, so anything else (whitespace, quotes, backticks, newlines) is rejected by `sbl models set` and dropped by the loader.
- `discoveredAt` is optional and set by discovery.
- `enabled: false` keeps the configuration but behaves like "no configuration" for rendering and writes `model: inherit` (Claude) or no `model` line (OpenCode) into the agent files.

Loading (`loadConfig`) never throws and always returns a normalized version 2 object:

- Missing file: the default configuration (`enabled: false`, no tiers). Unparsable or non-object JSON: the default configuration with `enabled: false`.
- **Version 1 migration** (any file whose `version` is not `2`): `enabled` is kept; OpenCode `standard` = the first non-empty of `individual.workhorse`, `tiers.workhorse`, `resolved.workhorse`; OpenCode `light` = the same for `budget`; `resolved.discoveredAt` becomes `discoveredAt`; `mode` and `families` are dropped. Claude tiers are not migrated, because v1 Claude values were OpenCode ids.
- Every write persists version 2. `sbl update` writes the migrated file once and reports it.

`src/models/config.ts` keeps exporting `loadConfig` and `src/models/resolve.ts` keeps exporting `resolveTier(mainModel, tier, cfg)`, which now always returns `null`. The OpenCode plugin copied into projects by v1 imports both; with `null` it returns early and leaves the model alone, so a project that upgraded the package but has not run `sbl update` keeps working. `dist/templates/cc-session-hook.js` stays in the package as a no-op that exits 0, for the same reason. Both shims carry a comment that the next major version removes them.

### Router agents — one per tier and harness

| File | Written when the harness is router-installed |
|------|------|
| `.claude/agents/sbl-light.md`, `sbl-standard.md`, `sbl-strong.md`, `sbl-top.md` | Claude Code |
| `.opencode/agents/sbl-light.md`, `sbl-standard.md`, `sbl-strong.md`, `sbl-top.md` | OpenCode |

Claude Code file:

```markdown
---
name: sbl-standard
description: Standard tier — clearly specified routine work such as research, summaries, routine code, tests and documentation.
model: sonnet
---
Work on the delegated task exactly as briefed. Return the result with evidence (paths, sources, numbers), no raw logs.
```

OpenCode file: the same frontmatter plus `mode: subagent`; the `model` line is omitted when the tier has no model.

Descriptions (the part after the em dash):

- light: purely mechanical work such as searching, listing, extracting and reformatting.
- standard: clearly specified routine work such as research, summaries, routine code, tests and documentation.
- strong: demanding work with clear boundaries such as complex implementation, debugging and reviews.
- top: analysis, design, architecture and every decision where a mistake is costly; everything backlog/docs/critical-areas.md lists as critical.

Writing rules:

- A missing agent file is created from the template with the current model.
- An existing agent file keeps its content; only its `model:` line is replaced, inserted after the opening `---` when absent, or removed when an OpenCode tier has no model. User edits to description and body survive.
- The model is always concrete at write time, so `TIER_PLACEHOLDER` no longer exists anywhere.

A harness is **router-installed** when its agents directory holds any v2 agent file or any v1 agent file (`sbl-worker.md`, `sbl-worker-cheap.md`), or, for OpenCode, `.opencode/plugins/sbl-model-router.js` exists. `sbl init --models` and `sbl models enable` install both harnesses, as v1 did.

### Legacy cleanup

Whenever the router is applied, for every router-installed harness:

- delete `.claude/agents/sbl-worker.md`, `.claude/agents/sbl-worker-cheap.md`, `.opencode/agents/sbl-worker.md`, `.opencode/agents/sbl-worker-cheap.md` and `.opencode/plugins/sbl-model-router.js` when present;
- remove the SessionStart entries whose hook `args[0]` contains `cc-session-hook.js` from `.claude/settings.json`, reusing the uninstall logic. Other hooks and keys stay. An unparsable `settings.json` is left alone with a warning line instead of an exception.

Each removal prints one line (`removed legacy <path>`).

### Applying the router — one function

`applyRouter(cwd, { install, block, version })` in `src/models/apply.ts` is the only code path that writes router files. It returns the report lines.

1. Load the configuration (migrated in memory). When `.super-backlog/models.json` exists and its content differs from the normalized form, write it back.
2. Determine the harnesses: both when `install` is true, otherwise the router-installed ones.
3. For each harness: write the four agent files, then run the legacy cleanup.
4. When `block` is true and `AGENTS.md` contains the managed block, re-inject it with the rendered examples.

Callers:

| Caller | install | block |
|--------|---------|-------|
| `sbl init --models` (action `install-model-router`) | true | false (the init's own block injection runs after it) |
| `sbl update` (new refresh action `refresh-model-router`) | false | false (update re-injects the block itself, after this action) |
| `sbl models enable` | true | true |
| `sbl models disable`, `set`, `discover` | false | true |
| Dashboard POST enable / disable / discover | as the CLI | true |

`sbl update` with neither `models.json` nor router files prints nothing about the router.

### Block examples — rendered from the configuration

`src/templates/workflow-block.md` replaces the static example paragraph with the placeholder `{{MODEL_EXAMPLES}}`. `agentsBlockContents(version, cwd)` substitutes it with `renderModelExamples(config)` from `src/models/render.ts`. Nothing else in the block changes.

Without a configuration, or with `enabled: false`, the rendered text is byte-identical to today's static paragraph:

```markdown
Examples (current as of this super-backlog release):

- Claude Code: the Agent tool's `model` parameter — light `haiku`, standard
  `sonnet`, strong `opus`, top = the strongest available model (e.g. Fable).
- OpenCode: set the tier's model on the subagent, e.g. the `model` field of
  an agent in `.opencode/agents/`.
- Other harnesses: the equivalent per-subagent model setting.
```

With an enabled configuration:

```markdown
Examples (from `.super-backlog/models.json`; change them with
`sbl models set <harness> <tier> <model>`):

- Claude Code: the Agent tool's `model` parameter — light `haiku`, standard
  `sonnet`, strong `opus`, top `fable`.
- OpenCode: the `sbl-<tier>` agents in `.opencode/agents/` — light
  `opencode/gemini-3.5-flash-lite`, standard `opencode/claude-sonnet-4-6`;
  tiers without a model use the session model.
- Other harnesses: the equivalent per-subagent model setting.
```

- The Claude line lists all four tiers, each the configured value or the default.
- The OpenCode line lists only configured tiers in tier order. With no OpenCode tier configured, it is the default OpenCode line. The trailing clause about tiers without a model appears only when at least one tier is missing.
- List items wrap at 80 columns at word boundaries with a two-space continuation indent; a model id is never split.

`init` plans `install-model-router` before `inject-agents-block`, so an init with `--models` renders the configured examples. `update` plans `refresh-model-router` before `inject-agents-block`, so the migration runs before rendering.

### Discovery — four tiers for OpenCode

`discoverModels(cwd)` keeps running `opencode models` and keeps `parseOpenCodeModels`. `rankTiers` becomes `rankFourTiers(available): Partial<Record<Tier, string>>` with ordered substring preferences, case-insensitive, first match wins within each pattern, earlier patterns win over later ones:

| Tier | Preferences, in order | Excluded |
|------|------|------|
| top | `fable`, `mythos`, `opus` | light matches |
| strong | `opus`, `codex`, `gpt-5`, `-pro` | light matches |
| standard | `sonnet`, `flash`, `k2.5` | light matches |
| light | `haiku`, `flash-lite`, `nano`, `-lite`, `-mini` | — |

A "light match" is an id containing any light pattern. A tier without a match stays unset; top falls back to strong's pick when it has none.

`sbl models discover` now persists like the dashboard does: it writes `tiers.opencode` (replacing the previous OpenCode tiers) and `discoveredAt`, applies the router, and prints the tiers. On failure it prints `discovery failed (is the OpenCode CLI available?)` and exits 1 without writing. Claude Code has no discovery; its defaults are aliases that track Anthropic's current models.

### CLI — `sbl models`

| Command | Effect |
|---------|--------|
| `sbl models` / `sbl models show` | prints the normalized version 2 configuration as JSON |
| `sbl models enable` | `enabled: true`, apply with install |
| `sbl models disable` | `enabled: false`, apply |
| `sbl models set <harness> <tier> <model>` | sets one tier; the model `-` removes the entry; apply |
| `sbl models discover` | as above |

`set` validates harness, tier and model id and exits 1 with a one-line message naming the allowed values. `set` and `discover` never change `enabled`; on a project without `models.json` they create it disabled and print `router is disabled; run sbl models enable to use these tiers`. The help line becomes `models  Manage the model router (show, enable, disable, set, discover)`.

### Dashboard

- The button subtitle becomes `light · standard · strong · top`.
- The dialog keeps the status chip, the enable toggle and the discover button. A table with the rows Light / Standard / Strong / Top and the columns Claude Code / OpenCode replaces the two Workhorse / Budget cells. Unset OpenCode cells show `session model`.
- Below the table, a copyable hint `sbl models set <harness> <tier> <model>`.
- The API returns the version 2 configuration; POST enable, disable and discover call `applyRouter` with `block: true`.

### Uninstall

`ROUTER_FILES` lists the eight v2 agent files in addition to the v1 files, so uninstall cleans both generations. The SessionStart stripping stays.

### Docs

- New reference page `docs/guide/model-router.md` (frontmatter `type: reference`, sidebar entry): configuration format, tiers and defaults, commands, files written, migration from v1.
- The quickstart router section, `docs/guide/harness-support.md`, `docs/index.md` and `README.md` drop workhorse / budget and link the new page.

## Units

1. **Configuration v2** — `src/models/types.ts`, `defaults.ts`, `config.ts`, `install.ts`, the `resolve.ts` shim; `family.ts` is deleted. Tests: normalization, validation, v1 migration.
2. **Discovery** — `src/models/discovery.ts` with `rankFourTiers`. Tests with fixture output.
3. **Agents, apply and legacy cleanup** — new `src/models/agents.ts` and `src/models/apply.ts`; `claude.ts` and `opencode.ts` are folded into them and deleted together with the v1 agent and plugin templates; `cc-session-hook.js` becomes the no-op shim; uninstall's `ROUTER_FILES` grows. Tests: create, update preserving edits, legacy removal, unparsable settings.
4. **Block rendering** — `src/models/render.ts`, `{{MODEL_EXAMPLES}}` in the block template, `agentsBlockContents(version, cwd)`, planner order. Tests: byte-identical default, configured output, wrapping.
5. **CLI, init and update wiring** — `src/commands/models.ts`, the `install-model-router` and new `refresh-model-router` actions, `src/commands/update.ts`. Tests: CLI integration, e2e init → update migration → uninstall.
6. **Dashboard** — `src/models/dashboard-api.ts`, the models dialog in `src/templates/dashboard.html`, snapshot updates.
7. **Docs and dogfood** — the reference page and doc updates, `backlog/docs/architecture.yml` file lists, `sbl update --no-self` on this repository.

Units 1 → 3 → 4 → 5 → 6 → 7 build on each other; unit 2 depends only on unit 1.

## Testing

- Unit tests per module as listed; test fixtures in temp directories, never the real `~/.super-backlog`.
- e2e: a v1 project fixture (v1 `models.json`, `sbl-worker*.md` with `TIER_PLACEHOLDER`, the plugin, a `settings.json` with the sbl hook and one foreign hook) goes through `sbl update`: v2 file, eight agent files with concrete models, legacy files gone, foreign hook kept, block examples rendered. `sbl uninstall` then removes every router file.
- `test/unit/templates.test.ts` asserts the default rendering keeps today's example strings.
- `npm test`, `npm run lint`, `npx vitepress build docs`, `sbl summary --check` and the docs gate pass.

## Out of scope

- Router support for harnesses other than Claude Code and OpenCode.
- Model discovery for Claude Code.
- Editing tiers in the dashboard.
- A doctor check for the router.
- Removing the compatibility shims (next major version).
