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

## Dashboard did not regenerate

If `dashboard.html` is stale after committing backlog changes:

1. **Hook installed?** `.git/hooks/post-commit` should contain a `# >>> super-backlog dashboard-refresh` block. If not, re-run `sbl init` (or `sbl update`) — it is skipped when init ran with `--no-refresh-hook`.
2. **Commit touched `backlog/`?** The hook regenerates only when the commit's diff includes `backlog/*`.
3. **Is node available?** The hook invokes `node` from your `PATH`.
4. **Run it manually:** `npx super-backlog dashboard` (or `npm run dashboard`) — its error output points at the real cause.

The hook never blocks commits: on failure it prints a one-line stderr note (`super-backlog: dashboard regeneration failed …`) while the commit still succeeds.

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
- `SBL_FORCE_OFFLINE=1` — forces `sbl update` to take its offline path deterministically (skips the published-version comparison), so e2e runs behave identically without network access.
- `SBL_FAKE_POLICY=<policy>` — overrides the PowerShell execution policy that `sbl doctor` and `init` detect. Accepts `Restricted`, `AllSigned`, `RemoteSigned`, `Unrestricted`, `Bypass`, or `Undefined`. Makes tests deterministic on every platform.

Both variables are unset-and-empty tolerant; any non-empty value activates the seam.
