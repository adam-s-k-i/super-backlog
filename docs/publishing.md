# Publishing super-backlog

Who: the maintainer (@adam-s-k-i) publishes. Releases are manual — there is no
automated publish pipeline.

## When to publish

- CI is green on `master` (both OS in the matrix).
- `CHANGELOG.md` has an entry for the version about to be published.
- All tasks for the milestone are `Done` in the backlog.

## Pre-publish checklist

1. Bump `version` in `package.json` (semver: fix → patch, feature → minor).
2. Add the matching `CHANGELOG.md` entry.
3. `npm ci && npm test` — full suite green.
4. `npm pack --dry-run` — tarball contains only `dist/**`, `README.md`,
   `LICENSE`, `package.json`.
5. Extract the tarball to a temp dir and run `node <extracted>/dist/cli.js --version`
   plus `--help` (bin smoke test).
6. Commit: `chore(release): v<x.y.z>` and tag `git tag v<x.y.z>`.

## Publish

```bash
npm login
npm publish
git push origin master --tags
```

Then create a GitHub Release from the tag, pasting the CHANGELOG section.

## After publish

- Run `sbl update` in a dogfood project and confirm the new version is picked up.
- Watch the first-install issues for Windows plugin-spec problems and update
  `docs/troubleshooting.md` if the fallback triggers.
