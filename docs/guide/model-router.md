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
| `top` | Analysis, design, architecture, decisions where a mistake is costly or hard to reverse | `fable` | session model |

The Claude Code defaults are aliases that track Anthropic's current models. OpenCode has no defaults: a tier without a model gets no `model` line, and OpenCode uses the session model.

## Commands

| Command | Effect |
| --- | --- |
| `sbl models` / `sbl models show` | Print the normalized configuration as JSON. |
| `sbl models enable` | Set `enabled: true` and install the agents for both harnesses. |
| `sbl models disable` | Set `enabled: false` and rewrite the agents. |
| `sbl models set <harness> <tier> <model>` | Set one tier. The model `-` removes the entry. |
| `sbl models discover` | Rank the models that `opencode models` lists into the four OpenCode tiers and save them. |

`set` and `discover` never change `enabled`. On a project without `models.json` they create it disabled. Whenever the resulting configuration is disabled, they print a reminder to run `sbl models enable`.

Only `sbl models enable`, `sbl init --models` and the dashboard's enable toggle install the agents, for both harnesses. `set`, `discover` and `disable` rewrite the agent files only for a harness where the router is already installed. Every `sbl models` command that changes the configuration also re-renders the managed block in `AGENTS.md`. `sbl update` keeps installed router files current; it never installs them.

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

## Errors and warnings

**Invalid `models.json`.** A `models.json` that is not valid JSON is never rewritten. A leading UTF-8 byte order mark, as some Windows editors write it, is accepted and does not make the file invalid. Every command reports the same message, `.super-backlog/models.json is not valid JSON - left unchanged; fix or delete it`:

- Commands that change the configuration refuse to run. `sbl models set`, `enable`, `disable` and `discover` print the message and exit with code 1. `discover` checks the file before it runs `opencode models`. In the dashboard, the toggle and the discover button show `failed ✗`; the discover button carries the message as its tooltip.
- `sbl init --models` prints the message as a warning, followed by `(model router not installed)`, and finishes the rest of the installation without the router.
- `sbl update` prints the message as a warning and treats the router as disabled: installed Claude Code agents get `model: inherit`, and OpenCode agents lose their `model` line.
- `sbl models show` prints the message as a warning on stderr, then the default configuration.

Fix the JSON or delete the file, then run the command again.

**Newer `models.json` version.** A `models.json` whose `version` is higher than `2` was written by a newer super-backlog. It is never rewritten or downgraded, and the commands report `.super-backlog/models.json has version <n>, which this super-backlog does not support - left unchanged; upgrade super-backlog or delete it` instead of the message above. Commands that change the configuration refuse to run, as for an invalid file, and `sbl models show` prints the defaults. `sbl update` warns but leaves the installed agent files unchanged, so it does not downgrade agents that the newer release wrote; the v1 cleanup also waits until the file is readable again. A `version` that is not a number, or a number below `2`, is read as version 1 and migrated.

**Invalid `.claude/settings.json`.** When the v1 cleanup cannot parse `.claude/settings.json`, it prints `warning: .claude/settings.json is not valid JSON - legacy SessionStart hook left in place` and changes nothing in that file. Fix the file and run `sbl update` again to remove the hook.

In `sbl update`, router warnings join the update's warning list, so the update exits with code 4. If the router refresh itself fails, for example on a locked agent file, the update reports `model router refresh failed: <reason>` as a warning and still refreshes the block, the pointer and the skills.

## Migration from router v1

Router v1 had two tiers (`workhorse`, `budget`), a `SessionStart` hook for Claude Code and a `chat.params` plugin for OpenCode. The first `sbl update` after upgrading:

- rewrites `models.json` as version 2: `workhorse` becomes the OpenCode `standard` tier, `budget` the OpenCode `light` tier, and `mode` and `families` are dropped. Claude tiers start from the defaults;
- writes four `sbl-<tier>.md` agents with concrete models for each harness where the router is installed, eight when both are;
- removes `sbl-worker.md`, `sbl-worker-cheap.md`, `.opencode/plugins/sbl-model-router.js` and the router's `SessionStart` entry in `.claude/settings.json`. Other hooks and settings stay.

Each removal prints one `removed legacy <path>` line.

The deletion also applies to v1 agent files you edited. Copy any changes you made out of `sbl-worker.md` or `sbl-worker-cheap.md` before you run `sbl update`. Foreign hooks in `.claude/settings.json` stay untouched.

`sbl update` only maintains a harness where the router is already installed (v1 files count as installed). `sbl init --models` or `sbl models enable` installs the router.

## Dashboard

The **Model Router** button in the dashboard opens a dialog with the router state, an enable / disable toggle, a discover button and a table of the four tiers for Claude Code and OpenCode. Switching the toggle on works like `sbl models enable`: it also installs the agents for both harnesses. Switching it off works like `sbl models disable`. Unset OpenCode tiers show "session model". Tiers are edited on the command line; the dialog offers `sbl models set <harness> <tier> <model>` to copy.

## Uninstall

`sbl uninstall` removes `models.json`, the agent files of both router generations and the router's `SessionStart` entry, whether that hook is written with `args` or as a single `node <path>` command string. A hook that passes further arguments, runs another interpreter or contains shell syntax such as `;`, `|`, `&&` or `$(...)` is not the router's and stays; `$CLAUDE_PROJECT_DIR` is the only variable allowed in the path.
