# Troubleshooting

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
| `4` | success with warnings (e.g., manual steps required — Claude plugin install instructions printed) |

## Environment seams (for testing and CI)

- `SBL_SKIP_INSTALL=1` — makes `init` fabricate a minimal `backlog/config.yml` instead of invoking upstream installs. Tests never touch the network or install packages.
- `SBL_FORCE_OFFLINE=1` — forces `sbl update` to take its offline path deterministically (skips the published-version comparison), so e2e runs behave identically without network access.

Both variables are unset-and-empty tolerant; any non-empty value activates the seam.
