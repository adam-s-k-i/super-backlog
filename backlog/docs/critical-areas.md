# Critical areas

Status: 2026-10-10, created with Fable 5.1

Always on the top tier:
- Release and publish: `.github/release-please-config.json`, `release.yml`,
  `publish.yml`, anything that changes what `npm publish` ships
- Managed blocks in user repos: `src/lib/markers.ts` (`injectBlock`),
  `src/lib/pointer.ts` (`refreshPointer`) - a wrong edit destroys user content
  in AGENTS.md or CLAUDE.md
- Ownership and uninstall: `src/lib/ownership.ts`, `src/commands/uninstall.ts`,
  `src/models/uninstall.ts` - deleting files that are not ours
- Hub state and hooks: `src/lib/hub-state.ts` (writes `~/.super-backlog`),
  `src/lib/hooks.ts` (guard and refresh hooks with marker blocks)
- Model-router installs: `src/models/` writes into user `.claude/settings.json`
  and `.opencode/` directories

Independent check: release and publish, uninstall paths, marker and pointer
rewrites

May go to lower tiers: dashboard rendering, docs, template wording, test
scaffolding, backlog bookkeeping
