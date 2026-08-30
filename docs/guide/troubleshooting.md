---
type: reference
---

# Troubleshooting

## Windows: PowerShell execution policy blocks `npx super-backlog`

PowerShell's default execution policy on many machines (`Restricted`) refuses to run `.ps1` scripts. Because `npx`/`npm` installs shim files like `sbl.ps1`, this can block super-backlog before it even starts, producing an error such as:

```text
cannot be loaded because running scripts is disabled on this system.
```

The recommended fix is to allow signed scripts for the current user only (no admin rights required):

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Run `sbl doctor` to see the current effective policy and the exact command to run.

### What the policy names mean

| Policy | Result |
|---|---|
| `Restricted` | **Blocking** — default on some systems; no `.ps1` may run. |
| `AllSigned` | **Blocking for unsigned shims** — all scripts must be signed by a trusted publisher. |
| `RemoteSigned` | **Recommended** — local scripts run; downloaded scripts must be signed. |
| `Unrestricted` / `Bypass` | **Permissive** — runs, but `RemoteSigned` is the safer choice. |

To check the current policy without running `sbl doctor`:

```powershell
Get-ExecutionPolicy
```

To check whether the restriction came from a specific scope:

```powershell
Get-ExecutionPolicy -List
```

## Windows + Node 24: `sbl dashboard` disables live reload

Node 24 on Windows has a libuv bug that crashes the process when watching directories recursively. If you run `sbl dashboard` on Windows under Node 24, super-backlog starts the server but disables live reload and prints a warning. The dashboard still serves and regenerates on manual refresh. Live reload works again on Node 22 or on Linux/macOS. This guard will be removed once Node ships a fix.

## Windows: OpenCode fails to resolve the git-backed plugin spec

OpenCode on Windows can fail to cache git-backed plugin specs. If the Superpowers plugin does not load after `sbl init`, install it into OpenCode's config directory directly:

```text
npm install superpowers@git+https://github.com/obra/superpowers.git --prefix "$HOME\.config\opencode"
```

Then point `opencode.json` at the installed copy instead of the git spec:

```json
"plugin": ["~/.config/opencode/node_modules/superpowers"]
```

An automated check for this situation arrives with `sbl doctor` (v2 backlog).

## Dashboard did not update

`sbl dashboard` watches `backlog/` while the server runs and regenerates the served HTML on changes. If the dashboard looks stale:

1. **Is the server running?** `sbl dashboard` must be active for live reload; the dashboard is not a committed static file.
2. **Did you change files under `backlog/`?** Only edits inside `backlog/` trigger a reload.
3. **On Windows under Node 24** live reload is disabled due to a libuv bug; refresh the browser tab manually or restart the server.
4. **Restart manually:** press `Ctrl+C` and run `sbl dashboard` again — any generation errors are printed to the terminal.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | ok |
| `1` | usage/detection failure (bad flags, invalid JSON in files we must parse) |
| `2` | ownership or merge refusal (a file cannot be attributed to the kit) |
| `3` | upstream command failure (`npm`/`backlog init` failed) |
| `4` | success with warnings (e.g., manual steps required — Claude plugin install instructions printed); `sbl doctor` also returns `4` when it detects a blocking PowerShell execution policy |

## Environment seams (for testing and CI)

- `SBL_SKIP_INSTALL=1` — makes `init` fabricate a minimal `backlog/config.yml` instead of invoking upstream installs. Tests never touch the network or install packages.
- `SBL_FORCE_OFFLINE=1` — forces `sbl update` to take its offline path deterministically: it also skips the self-update check (see below) and skips the published-version comparison, so e2e runs behave identically without network access.
- `SBL_FAKE_POLICY=<policy>` — overrides the PowerShell execution policy that `sbl doctor` and `init` detect. Accepts `Restricted`, `AllSigned`, `RemoteSigned`, `Unrestricted`, `Bypass`, or `Undefined`. Makes tests deterministic on every platform.

These variables are unset-and-empty tolerant; any non-empty value activates the seam.

### Skipping the self-update

`sbl update` first checks whether it is running as a globally installed CLI and, if a newer version is published, installs it and re-runs itself once before doing anything else. Opt out with the `--no-self` flag, or set `SBL_SKIP_UPDATE_CHECK=1` (also skips the periodic version-hint check on other commands). `SBL_FORCE_OFFLINE=1` skips it too, since it implies no network is available.
