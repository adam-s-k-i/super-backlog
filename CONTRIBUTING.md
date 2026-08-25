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
