---
type: reference
---

# Model router

The model router is optional. It writes one subagent per tier — `sbl-light`, `sbl-standard`, `sbl-strong` and `sbl-top` — for Claude Code and OpenCode, each with a fixed model, and renders the model examples in the managed `AGENTS.md` block from your configuration. The block's [delegation rule](harness-support#model-tiers-and-delegation-all-harnesses) applies with or without the router.

Install it into a new project:

```bash
sbl init --models
```

`sbl models enable` installs it into an existing project.

## Configuration

The router reads `.super-backlog/models.json`:

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

- `version` is always `2`.
- `enabled` switches the router on and off. While it is `false` the configuration is kept, the block shows the release's generic examples, Claude Code agents get `model: inherit` and OpenCode agents get no `model` line.
- `tiers` holds one optional entry per harness (`claude`, `opencode`) and tier (`light`, `standard`, `strong`, `top`).
- `discoveredAt` is set by `sbl models discover`.

A model id starts with a letter or digit, contains only letters, digits and `. _ : / @ + -`, does not end with `:`, and has at most 100 characters. `sbl models set` rejects other ids; the loader drops them.

## Tiers and defaults

| Tier | Use it for | Claude Code default | OpenCode default |
| --- | --- | --- | --- |
| `light` | Purely mechanical work: searching, listing, extracting, reformatting | `haiku` | session model |
| `standard` | Clearly specified routine work: research, summaries, routine code, tests, documentation | `sonnet` | session model |
| `strong` | Demanding work with clear boundaries: complex implementation, debugging, reviews | `opus` | session model |
| `top` | Analysis, design, architecture, costly decisions, everything the [project profile](project-profile) lists as critical | `fable` | session model |

The Claude Code defaults are aliases that track Anthropic's current models. OpenCode has no defaults: a tier without a model gets no `model` line, and OpenCode uses the session model.

## Commands

| Command | Effect |
| --- | --- |
| `sbl models` / `sbl models show` | Print the normalized configuration as JSON. |
| `sbl models enable` | Set `enabled: true` and install the agents for both harnesses. |
| `sbl models disable` | Set `enabled: false` and rewrite the agents. |
| `sbl models set <harness> <tier> <model>` | Set one tier. The model `-` removes the entry. |
| `sbl models discover` | Rank the models that `opencode models` lists into the four OpenCode tiers and save them. |

`set` and `discover` never change `enabled`. On a project without `models.json` they create it disabled and print a reminder to run `sbl models enable`.

Every command that changes the configuration rewrites the agent files and the managed block in `AGENTS.md`. `sbl update` keeps installed router files current; it never installs them.

### Discovery

`sbl models discover` matches substrings of the listed ids, case-insensitively. Earlier patterns win; within a pattern the first listed id wins.

| Tier | Preferences, in order |
| --- | --- |
| `top` | `fable`, `mythos`, `opus` (falls back to the `strong` pick) |
| `strong` | `opus`, `codex`, `gpt-5`, `-pro` |
| `standard` | `sonnet`, `flash`, `k2.5` |
| `light` | `haiku`, `flash-lite`, `nano`, `-lite`, `-mini` |

Ids that match a `light` pattern are never picked for the other tiers. Discovery replaces the previous OpenCode tiers. Claude Code has no discovery.

## Files written

| File | Written when |
| --- | --- |
| `.super-backlog/models.json` | Any `sbl models` command that changes the configuration, `sbl init --models`, or `sbl update` migrating a version 1 file |
| `.claude/agents/sbl-<tier>.md` | The router is installed for Claude Code |
| `.opencode/agents/sbl-<tier>.md` | The router is installed for OpenCode (with `mode: subagent`) |

An existing agent file keeps your edits to its description and body; only its `model:` line is replaced, inserted or removed.

## Migration from router v1

Router v1 had two tiers (`workhorse`, `budget`), a `SessionStart` hook for Claude Code and a `chat.params` plugin for OpenCode. The first `sbl update` after upgrading:

- rewrites `models.json` as version 2: `workhorse` becomes the OpenCode `standard` tier, `budget` the OpenCode `light` tier, and `mode` and `families` are dropped. Claude tiers start from the defaults;
- writes the eight `sbl-<tier>.md` agents with concrete models;
- removes `sbl-worker.md`, `sbl-worker-cheap.md`, `.opencode/plugins/sbl-model-router.js` and the router's `SessionStart` entry in `.claude/settings.json`. Other hooks and settings stay.

Each removal prints one `removed legacy <path>` line.

The deletion also applies to v1 agent files you edited. Copy any changes you made out of `sbl-worker.md` or `sbl-worker-cheap.md` before you run `sbl update`. Foreign hooks in `.claude/settings.json` stay untouched.

`sbl update` only maintains a harness where the router is already installed (v1 files count as installed). `sbl init --models` or `sbl models enable` installs the router.

## Dashboard

The **Model Router** button in the dashboard opens a dialog with the router state, an enable / disable toggle, a discover button and a table of the four tiers for Claude Code and OpenCode. Unset OpenCode tiers show "session model". Tiers are edited on the command line; the dialog offers `sbl models set <harness> <tier> <model>` to copy.

## Uninstall

`sbl uninstall` removes `models.json`, the agent files of both router generations and the router's `SessionStart` entry.
