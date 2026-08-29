# sbl CLI, Dashboard Hub, and Version Hint — Design Spec

- **Date:** 2026-08-29
- **Status:** Approved for planning
- **Scope:** Command surface, dashboard multi-project hub, npm version hint, CLI contract tests

## 1. Problem

The viewing CLI grew aliases (`serve`, `browser`, `board`) and stale `--serve` docs while `sbl dashboard` already is the live server. Two projects cannot keep a stable browser URL: both fight `127.0.0.1:6428`, so a bookmark can silently show the wrong repo. There is no check that the global `super-backlog` package is outdated. Command coverage is uneven.

## 2. Goal

One viewing command, one stable per-project URL on a single local hub, a non-blocking outdated-package hint, and a contract test net for every remaining command.

## 3. Key Decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Viewing command | Only `sbl dashboard`. Always live on `127.0.0.1:6428`. No `--serve`, no `--no-watch`. |
| D2 | Removed commands | `serve`, `browser`, `board` are not in help. Invoking them exits 1 with a pointer to `sbl dashboard`. |
| D3 | Hub | First `sbl dashboard` is the hub process. Later invocations are clients that register `cwd` and open the project URL. |
| D4 | URL shape | `http://127.0.0.1:6428/p/<slug>/`. `GET /` lists registered projects. |
| D5 | Slug | Sanitized `project_name` from `backlog/config.yml`, else directory basename. No path hash. Same slug + different realpath → error. |
| D6 | Hub lifetime | Foreground in the first terminal. Ctrl+C stops the hub and drops all projects. No detached daemon, no `sbl://` protocol. |
| D7 | Port | Hub listens on 6428. Occupied by our hub → attach. Occupied by something else → error. `--port` is an emergency override and warns that bookmarks will not match the default. |
| D8 | Backlog browser spawn | `sbl dashboard` does not start `backlog browser`. Board/backlog UI buttons are a later story. |
| D9 | Version hint | At most once per 24h, cache under `~/.super-backlog/`. Print one stderr line if npm `latest` > installed version. Never install. Never change exit codes. |
| D10 | `init` / `update` | Unchanged. `init` stays the per-repo installer (idempotent re-run). `update` stays kit-file refresh, not npm self-update. |
| D11 | Docs language | English, matching existing specs. |

### Out of scope

- Install wizard / TUI (later story)
- Dashboard buttons for Board and Backlog browser (later story)
- Auto `npm i -g super-backlog`
- Custom protocol handlers or login autostart
- Smarter in-page reload (preserve scroll/modal)
- Changing `sbl models`, uninstall, or doctor behaviour except where CLI help/tests require it

## 4. Command surface

Kept: `init`, `uninstall`, `update`, `dashboard`, `models`, `doctor`, `help`, `--version` / `-v`.

Dashboard flags: `--port <n>`, `--no-open`. No other dashboard flags.

Removed from help and from successful dispatch: `serve`, `browser`, `board`.

Unknown command and removed commands share exit code 1. Removed commands print a dedicated two-line message, not the generic "Unknown command" block:

```text
error: "sbl serve" was removed; the live dashboard is `sbl dashboard`
```

Same pattern for `browser` and `board`.

`sbl dashboard` no longer writes `dashboard.html` into the project (already true). It still writes a temp HTML file per registered project as needed.

## 5. Hub architecture

```text
Terminal A (repo-a)                 Terminal B (repo-b)
sbl dashboard                       sbl dashboard
    │                                    │
    ▼                                    ▼
 Hub on 127.0.0.1:6428              Client: read hub.json
 ~/.super-backlog/hub.json          POST /api/hub/register
 watch repo-a/backlog               open /p/<slug-b>/
 serve /p/<slug-a>/                 exit 0
 Ctrl+C → hub gone
```

### 5.1 State file

Path: `join(homedir(), '.super-backlog', 'hub.json')`.

```json
{ "pid": 12345, "port": 6428, "token": "<opaque>" }
```

`token` is a random unguessable string created when the hub starts. Register requests must send it. The file mode should be user-readable only where the platform allows.

### 5.2 Become hub vs attach

On `sbl dashboard`:

1. Resolve slug from `cwd` (section 6). If slug is empty after sanitize, exit 1.
2. Read `hub.json` if present.
3. If `pid` is alive **and** `GET http://127.0.0.1:<port>/api/hub/status?token=<token>` returns 200 → **attach** (client).
4. Otherwise treat state as stale: if 6428 (or `--port`) is bound by a foreign process, exit 1 with that fact. If the port is free, **become hub**: listen, write `hub.json`, register `cwd`, serve, optional browser open, block until Ctrl+C.
5. On hub exit: close watchers, delete `hub.json` only if it still contains this pid.

Alive pid is `process.kill(pid, 0)` succeeding.

### 5.3 Client attach

POST `/api/hub/register` JSON `{ "cwd": "<absolute>", "token": "<token>" }` to 127.0.0.1 only.

- 200: `{ "ok": true, "slug": "...", "url": "http://127.0.0.1:<port>/p/<slug>/" }` then open that URL unless `--no-open`, then exit 0.
- 409: slug collision (section 6.2). Print both paths, exit 1. Do not start a second hub.
- 401: token mismatch. Exit 1, tell the user to stop the other hub.
- Connection failure after status said the hub was up: exit 1.

The client process does not stay running.

### 5.4 Routes

Hub-level (not project-scoped):

| Method | Path | Role |
|---|---|---|
| GET | `/` | HTML list of registered slugs and display names, each linking to `/p/<slug>/` |
| GET | `/api/hub/status` | `{ pid, port }` only if `?token=` matches `hub.json`. Missing or wrong token → 401. |
| POST | `/api/hub/register` | Register or refresh a project |

Project-scoped (everything that today lives at `/` and `/api/*` for one cwd):

| Method | Path | Role |
|---|---|---|
| GET | `/p/<slug>/` and `/p/<slug>/index.html` | That project's dashboard HTML |
| GET | `/p/<slug>/api/events` | SSE reload for that project |
| POST | `/p/<slug>/api/run` | Existing whitelist, executed with that project's cwd |
| * | `/p/<slug>/api/models`… | Existing model API, scoped to that cwd |

Unknown slug → 404. Trailing slash on `/p/<slug>` redirects to `/p/<slug>/`.

The dashboard HTML must call APIs with **relative** URLs (`api/events`, `api/run`) so they stay under `/p/<slug>/`. Absolute `/api/...` is a bug.

### 5.5 Watchers and reload

One `fs.watch` on `<cwd>/backlog` per registered project (same recursive-watch guard as today on Windows Node 24+). Regeneration and SSE broadcast go only to clients of that slug. A change in repo A must not reload repo B's tab.

### 5.6 `--port` and `--no-open`

`--no-open`: hub or client skips the browser opener.

`--port`: hub listens there and writes that port into `hub.json`. Stderr warning that default bookmarks (`:6428`) will miss this hub. Clients always honour `hub.json.port`, never assume 6428 when attaching.

If 6428 is taken by a foreign process and the user did not pass `--port`, exit 1. Do not silently pick 6429 (that would break URL stability).

### 5.7 Cold start after days

If the hub is not running, the bookmark fails in the browser (connection refused). Running `sbl dashboard` in that repo recreates the hub and the same `/p/<slug>/` URL. This spec does not auto-start a hub from a bookmark.

## 6. Slug rules

### 6.1 Source

1. `project_name` from `backlog/config.yml` if it is a non-empty string.
2. Else `basename(realpath(cwd))`.
3. Do not use `package.json` `name` or config `name` for the slug (those collide across clones more often and are not what the user chose).

Sanitize: Unicode NFKD, strip combining marks, lower case, spaces and underscores to `-`, drop every character except `[a-z0-9-]`, collapse repeated `-`, trim `-`. If the result is empty, exit 1 asking for a `project_name` in `backlog/config.yml`.

### 6.2 Collision

Identity key is `realpath(cwd)`, compared case-insensitively on win32.

| Incoming | Existing | Result |
|---|---|---|
| Same slug, same realpath | Re-register (refresh watcher if needed), return 200, open URL |
| Same slug, different realpath | 409. Message names both absolute paths and says to change `project_name` in one `backlog/config.yml` |
| Different slug | Register alongside |

Renaming `project_name` changes the URL. Old bookmarks 404 until the new slug is used. No redirects from old slugs.

## 7. Version hint

Separate from `sbl update` (kit files in the current repo). This hint is about the **global npm package** `super-backlog`.

### 7.1 When

Run the hint path from `main()` for every command except `help`, `--help`, `-h`, `--version`, `-v`.

Skip entirely when `SBL_SKIP_UPDATE_CHECK` is set to a non-empty value (tests and CI).

### 7.2 Cache

File: `join(homedir(), '.super-backlog', 'version-check.json')`.

```json
{ "checkedAt": "2026-08-29T12:00:00.000Z", "latest": "1.0.4" }
```

TTL: 24 hours from `checkedAt`.

### 7.3 Behaviour

1. If the cache is present and `latest` is a greater semver than `KIT_VERSION`, print one stderr line **before** the command runs:

   `super-backlog <latest> is available (installed <KIT_VERSION>). Update: npm i -g super-backlog`

2. If the cache is missing or older than 24h, **do not block the command**. Start a background fetch (`npm view super-backlog version`, via the same `.cmd` shim rules as the rest of the CLI on Windows), 2s timeout, write cache on success. Do not print a hint from that background fetch. The next `sbl` invocation shows it from cache.

3. Network errors, timeouts, and parse failures: keep the old cache if any, print nothing, exit code unchanged.

4. Never run `npm install`. Never prompt.

## 8. Error handling

| Situation | Exit | User-visible |
|---|---|---|
| Removed command | 1 | Dedicated two-line pointer to `sbl dashboard` |
| Empty slug | 1 | Ask to set `project_name` |
| Slug collision | 1 | Both realpaths |
| Port taken by foreign process | 1 | Port in use; hint `--port` as emergency only |
| Hub token mismatch | 1 | Stop the other hub or delete stale `hub.json` |
| Dashboard generate/listen failure | 1 | Existing `dashboard serve failed` pattern |
| Version hint failed | 0 (relative to the hint) | Silent |

Existing `init` / `uninstall` / `update` / `doctor` / `models` exit codes stay as they are.

## 9. Testing

New or extended automated tests, no live npm registry, no requirement for a real extra machine.

**CLI contract**

- Help text lists exactly the kept commands and dashboard flags; does not list `serve`, `browser`, `board`, or `--serve`.
- `--version` prints `KIT_VERSION`, exit 0.
- `serve` / `browser` / `board` each exit 1 and mention `sbl dashboard`.
- Unknown command still exit 1 with full help.

**Hub**

- First `sbl dashboard` listens on 6428 (or test port 0 / injected port), writes `hub.json`, serves HTML at `/p/<slug>/`.
- Second invocation with a different cwd and different slug attaches, register 200, does not bind a second port.
- Second invocation with the same slug and a different realpath exits 1; hub keeps the first project.
- Same cwd twice is 200, one registration.
- `GET /` contains links to both slugs when two projects are registered.
- SSE for slug A does not fire when only B's `backlog/` changes.
- Stale `hub.json` (dead pid) → new process becomes hub.
- Foreign occupant of the port → exit 1 (injectable listen error).
- Dashboard HTML uses relative `api/` URLs, not `/api/`.
- `--no-open` does not call the opener.

**Version hint**

- Fresh cache with newer `latest` prints the stderr line and does not call npm.
- `SBL_SKIP_UPDATE_CHECK=1` prints nothing and does not fetch.
- `help` / `--version` do not fetch and do not print the hint.
- Failed fetch does not change the command exit code.

**Smoke (existing commands, no behaviour change)**

- `init --dry-run` exits 0 or 4 as today.
- `doctor` exits 0 or 4.
- `models` without args does not crash (current show path).
- `update` in a temp kit dir does not crash (may skip work).
- These smokes may reuse fixtures already in `test/`. They are not a rewrite of init.

Windows Node 24 watcher skips stay as they are.

## 10. Docs and templates

Update user-facing strings that still say `sbl dashboard --serve` or `sbl serve` as the happy path: README, `docs/guide/*`, CLI `HELP`, skill templates that ship with the kit (`src/templates/skill-backlog-status-report.md` and copies). Troubleshooting keeps the Windows Node 24 live-reload warning but drops `--serve` wording.

Do not rewrite historical specs or archived tasks.

## 11. Non-goals recap for implementers

Do not add `sbl backlog`. Do not spawn the Backlog browser from dashboard. Do not auto-increment ports. Do not put a content hash in the slug. Do not install npm packages from the version hint. Do not build an install wizard in this work.

## 12. Implementation notes (constraints, not a plan)

- Hub and today's `startServeServer` should split: one HTTP server, many project registrations, each with cwd, slug, temp HTML path, regenerate, watcher, SSE broker.
- `runDashboard` grows a become-hub vs attach branch; register/status live next to existing `/api/run`.
- Version hint is a small module called from `cli.ts` `main()`, injectable for tests.
- Removed commands are explicit `switch` cases, not the `default` unknown path.

## 13. Success

A developer can bookmark `http://127.0.0.1:6428/p/my-app/`, run `sbl dashboard` in that repo weeks later, and see the same project. A second repo with a different `project_name` opens as a second tab on the same hub. `sbl serve` is gone. Outdated global installs show a one-line hint. Contract tests fail if aliases or `/api/` absolute paths come back.
