# Contributing

Thanks for helping improve super-backlog.

## Development

- **TDD expected**: write the failing test first, then the implementation. Every behavior change lands with test coverage.
- Run the full suite with vitest before pushing: `npm test` (builds first) or `npx.cmd vitest run` for a quick pass.
- TypeScript strict mode, ESM; import from `node:path` / `node:url`; zero runtime dependencies.
- All user-facing strings in English.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `chore:` …). One logical change per commit.

## PR checklist

- [ ] Failing test written first, then implementation
- [ ] `npm test` green locally
- [ ] Docs updated if commands/flags/manifest changed (`README.md`, `docs/`)
- [ ] No new runtime dependencies
- Follows the project pipeline described in `AGENTS.md`

## Documentation

Every docs page under `docs/` (except `docs/superpowers/`) declares a [Diátaxis](https://diataxis.fr/) type in its frontmatter:

- **tutorial** (`type: tutorial`) — learning-oriented; guides a newcomer step by step to a working result.
- **how-to** (`type: how-to`) — task-oriented; solves one concrete user problem, assumes existing context.
- **reference** (`type: reference`) — information-oriented; complete and factual, no narrative.
- **explanation** (`type: explanation`) — understanding-oriented; background, concepts, trade-offs.

Rules:

- One page covers exactly one topic, written from the user’s perspective — detailed in content, minimalist in presentation.
- New pages must be linked in `docs/.vitepress/config.mts` (sidebar); unlinked pages are invisible on GitHub Pages.
- A CI gate (Docs-Gate job in `pr-hygiene.yml`) blocks `feat:` PRs that change `src/` without a docs update. Apply the `no-docs` label for features without user-facing surface.
- Changes to `scripts/check-docs-required.mjs` or `.github/workflows/pr-hygiene.yml` require explicit maintainer sign-off: the gate runs PR-controlled code, so review such PRs with extra care.
