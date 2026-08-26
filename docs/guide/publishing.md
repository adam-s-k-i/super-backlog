# Publishing super-backlog

Releases are fully automated. Merging Conventional-Commit PRs into `master`
is the only manual act required to ship a release.

## Automated flow

1. Merge normal PRs with Conventional Commit titles (`feat:`, `fix:`, ...).
2. The [Release workflow](../../.github/workflows/release.yml) (release-please)
   maintains exactly one open **Release PR** that bumps the version in
   `package.json` and adds the matching `CHANGELOG.md` entry.
3. Once all required checks are green, that Release PR is merged
   automatically (label: `autorelease`).
4. The merge creates tag `v<x.y.z>` and immediately triggers the
   [Publish workflow](../../.github/workflows/publish.yml), which:
   - builds and runs the full test suite,
   - verifies tag ↔ version ↔ CHANGELOG consistency
     (`scripts/verify-release.mjs`),
   - validates the pack file list (`scripts/check-pack-list.mjs`),
   - publishes to npm with OIDC provenance (`npm publish --provenance`),
   - creates the GitHub Release from the CHANGELOG section.

> Implementation note: release-please creates tags using `GITHUB_TOKEN`, and
> events triggered by `GITHUB_TOKEN` do not start other workflows. The Publish
> workflow is therefore a reusable workflow invoked by Release the moment
> release-please reports a new release — semantically identical to being
> tag-triggered, without needing any personal access token.

## One-time setup

1. Register the **npm trusted publisher**: on npmjs.com open package
   `super-backlog` → Settings → Trusted Publisher, and bind it to
   repository `adam-s-k-i/super-backlog`, workflow file `publish.yml`,
   environment `(none)`. Until this is done, the publish step fails fast at
   `npm publish --provenance`.
2. Enable GitHub Actions as the Pages source (done once via API, see
   [Operations](operations.md)).

## Emergency manual fallback

Only if automation is broken:

```bash
npm ci && npm test
npm version <patch|minor|major>
# add CHANGELOG entry for the new version, then:
git commit --amend --no-edit && git tag -f v$(node -p "require('./package.json').version")
git push origin master --tags --force-with-lease
npm login
npm publish --access public
```

Then create the GitHub Release from the tag manually, pasting the CHANGELOG
section.

After an emergency release, bring `.release-please-manifest.json` back in
sync with the published version.
