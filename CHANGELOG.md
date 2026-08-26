# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.2](https://github.com/adam-s-k-i/super-backlog/compare/v0.3.1...v0.3.2) (2026-08-26)


### Bug Fixes

* **ci:** use NPM_TOKEN secret name for npm publish ([43a7fa1](https://github.com/adam-s-k-i/super-backlog/commit/43a7fa198074fe5dbf6e40582ab6e88906902e61))
* **dashboard:** disable recursive live reload on Node 24 Windows to avoid libuv crash ([59f9342](https://github.com/adam-s-k-i/super-backlog/commit/59f9342073831c029fed85d9ec47fe12db2668cd))

## [0.3.1](https://github.com/adam-s-k-i/super-backlog/compare/v0.3.0...v0.3.1) (2026-08-26)


### Bug Fixes

* **ci:** publish to npm via NPM_TOKEN secret, idempotent GitHub release step ([c7c1d31](https://github.com/adam-s-k-i/super-backlog/commit/c7c1d31a3fc89786c07251d50b9d753f33b34845))
* **release:** add package.json repository field + guard test (TASK-18) ([#15](https://github.com/adam-s-k-i/super-backlog/issues/15)) ([ef515b7](https://github.com/adam-s-k-i/super-backlog/commit/ef515b72084d838005935c8efa1accbff3d3cf7f))

## [0.3.0](https://github.com/adam-s-k-i/super-backlog/compare/v0.2.0...v0.3.0) (2026-08-26)


### Features

* **dashboard:** collector v2 - deps, activity, glossary (TASK-15) ([2e1ef25](https://github.com/adam-s-k-i/super-backlog/commit/2e1ef25d8e0d177ac266d556226d86f9a0be0f36))
* **dashboard:** glossary tooltips, detail panel, filter wiring (TASK-15) ([75c4646](https://github.com/adam-s-k-i/super-backlog/commit/75c4646917d5caff810093dd7d110f024222dcf3))
* **dashboard:** layered dependency graph with hover/click (TASK-15) ([a4e091e](https://github.com/adam-s-k-i/super-backlog/commit/a4e091e48e497c241f2063c03aa2db17ac4ac70b))
* **dashboard:** post-commit freshness hook + regen entry (TASK-15) ([f890295](https://github.com/adam-s-k-i/super-backlog/commit/f890295835ad6618452028f3989b3ec39c1a032e))
* **dashboard:** svg donut, bars, sparkline, stepper (TASK-15) ([6b26202](https://github.com/adam-s-k-i/super-backlog/commit/6b2620258503de4bde3d3b17614279c9f1475932))
* **dashboard:** v2 layout skeleton in HTS design language (TASK-15) ([4454b7b](https://github.com/adam-s-k-i/super-backlog/commit/4454b7bc927a85b68f5d95dd06dc804a6f4f2f7c))
* **pages:** 800px centered logo, hero-equivalent heading typography ([3dc9e0d](https://github.com/adam-s-k-i/super-backlog/commit/3dc9e0d40c26fbaccf377644256d6a2a495c4e94))
* **pages:** brand color from logo B ([#9740](https://github.com/adam-s-k-i/super-backlog/issues/9740)F8) + hero gradient ([5769847](https://github.com/adam-s-k-i/super-backlog/commit/5769847acdc79ccb37998a72b47a4ea14eecfe43))
* **pages:** hero logo and intro video section on landing page ([7001178](https://github.com/adam-s-k-i/super-backlog/commit/700117812327e59ef26c1f3e3dc1f8fe0bf5b79e))
* **pages:** logo above h1 on landing, drop hero layout and intro video ([3e3cbe6](https://github.com/adam-s-k-i/super-backlog/commit/3e3cbe60c824b969ac5a0044166363c358354bf8))
* **windows:** detect PowerShell execution policy, warn on init, add sbl doctor ([b3c0bd4](https://github.com/adam-s-k-i/super-backlog/commit/b3c0bd47b01ab49e3551a11b714caa2cbf1388e8))


### Bug Fixes

* **dashboard:** cycle-correct inline layering + v2 README screenshot ([e1ebc06](https://github.com/adam-s-k-i/super-backlog/commit/e1ebc06f9a9166321a5cc02d36ed83187b377bad))
* **doctor:** respect SBL_FAKE_POLICY seam on non-win32 platforms ([92b52d7](https://github.com/adam-s-k-i/super-backlog/commit/92b52d7d1ad04df2d27008656919cbb38849aafa))
* **pages:** set base and title so assets resolve under /super-backlog/; drop intro video link from README ([bd119ed](https://github.com/adam-s-k-i/super-backlog/commit/bd119edf7118d2882f7bdc2260095807fc960f2d))
* **qa:** pin weekly matrix to node 22, track node 24 regression as TASK-16 ([e8f137f](https://github.com/adam-s-k-i/super-backlog/commit/e8f137f5866a2b8f995356ae87ab7b7bf7108ef7))

## [0.2.0](https://github.com/adam-s-k-i/super-backlog/compare/v0.1.0...v0.2.0) (2026-08-26)


### Features

* **dashboard:** Project Dashboard data collection and single-file renderer ([6b0c97b](https://github.com/adam-s-k-i/super-backlog/commit/6b0c97b6ab20065deea27938418ded8381a06782))
* **dashboard:** serve mode with live regeneration; finalize CLI ([18b1afb](https://github.com/adam-s-k-i/super-backlog/commit/18b1afbf8f8088593bf0d20d4e79f580f17d0a9a))
* **docs:** VitePress docs site with live dashboard deploy (TASK-8) ([52b29f5](https://github.com/adam-s-k-i/super-backlog/commit/52b29f59b6f1e5b5e2949e3c0ce23044e4416393))
* **guard:** task validator and self-contained pre-commit guard hook ([6dcc740](https://github.com/adam-s-k-i/super-backlog/commit/6dcc7402382370680d19bf57150f1d6dc76a5625))
* **init:** pure ChangeSet planner ([4453581](https://github.com/adam-s-k-i/super-backlog/commit/445358191367f37a618dbf808c59f8f0257dc400))
* **init:** sbl init command with idempotent executor ([c3ad15b](https://github.com/adam-s-k-i/super-backlog/commit/c3ad15b485f695a027518e802c94d6f0fe5a9b3a))
* **lib:** additive package.json script/devDependency merges ([94369ba](https://github.com/adam-s-k-i/super-backlog/commit/94369bab93e358c7fd2f89e388bbca1e9da92908))
* **lib:** atomic file writer ([c394b41](https://github.com/adam-s-k-i/super-backlog/commit/c394b41d89cd87f42c252ea4b893c532dc723751))
* **lib:** flat YAML key reader for backlog config ([c5b052a](https://github.com/adam-s-k-i/super-backlog/commit/c5b052a6f726534a952414401c3d1e33818ff5df))
* **lib:** ownership fingerprints and opencode plugin merge ([24c1ae0](https://github.com/adam-s-k-i/super-backlog/commit/24c1ae0a500bf2858649e4ed649164e2deec8ded))
* **lib:** package manager detection ([5958e1c](https://github.com/adam-s-k-i/super-backlog/commit/5958e1c0c57a4900b33210ebc7be30ecf83656fc))
* **lib:** scaffold kit and add marker-block injection ([bee31e8](https://github.com/adam-s-k-i/super-backlog/commit/bee31e87ae132aa8822cf11b2f3871f0a56ff67f))
* **lib:** sync process runner and backlog bin resolution ([50b877d](https://github.com/adam-s-k-i/super-backlog/commit/50b877dc27dd24da520c6a809fa2313b4d975489))
* **scripts:** tested automation gates (title, pack list, SHA pinning, release verify) (TASK-7) ([d7ced22](https://github.com/adam-s-k-i/super-backlog/commit/d7ced2239a584da712db24aa65edf9cdc8f84e6b))
* **skills:** backlog-status-report and task-review-gate glue skills (TASK-5) ([380441f](https://github.com/adam-s-k-i/super-backlog/commit/380441f189a49a16cc9c40dd6afe001dc5db1f82))
* **templates:** workflow block, glue skill, claude pointer ([615a0b1](https://github.com/adam-s-k-i/super-backlog/commit/615a0b1c613fa052d0d289f50e55197655733186))
* **uninstall:** ownership-scoped clean removal ([5999b6c](https://github.com/adam-s-k-i/super-backlog/commit/5999b6ca99a3ff6f39e5d4356655fe8a153ebdb6))
* **update:** refresh injected glue and report upstream versions ([8f1688b](https://github.com/adam-s-k-i/super-backlog/commit/8f1688b8fefbab74f4c192449286d50b4cade42e))


### Bug Fixes

* **build:** copy templates into dist for runtime resolution ([21a3290](https://github.com/adam-s-k-i/super-backlog/commit/21a32905b47dac8019618f161d69584f0efe9576))
* **ci:** node 22 base after cspell@10 engine bump, sync lockfile, drop caller permissions block ([84fdbbd](https://github.com/adam-s-k-i/super-backlog/commit/84fdbbd1adec253fb2fcf55658005b708019ce84))
* **cli:** exit 1 on invalid JSON in init/update; accurate degraded-auto warning (TASK-1) ([b29fbad](https://github.com/adam-s-k-i/super-backlog/commit/b29fbadeeb6a3d130434c3d2b13799790d73d174))
* **cli:** final-review punch list (pointer anchor, dashboard ownership probe, exit codes, planner gate, claude instruction) ([f4f280d](https://github.com/adam-s-k-i/super-backlog/commit/f4f280ddd18cdc7b70da8e6e118dc6fa700e7991))
* **cli:** win32-safe spawns, up-front JSON validation, ownership kept-path coverage ([612ca77](https://github.com/adam-s-k-i/super-backlog/commit/612ca77544395c5515147e855756d605331b7a88))
* **dashboard:** recursive backlog watch and crash-safe browser opener ([721b5d8](https://github.com/adam-s-k-i/super-backlog/commit/721b5d8c243b61b1ac72b031f3553d28b77e7b72))
* **guard:** accept backlog.md filename stems with title suffix, case-insensitive ([517170a](https://github.com/adam-s-k-i/super-backlog/commit/517170a65eff2dfd900d0392b88d09e77c276ec1))
* **hygiene:** match autorelease: pending label for release PR auto-merge ([9e5724e](https://github.com/adam-s-k-i/super-backlog/commit/9e5724e6321339179f6a65b9835971e7b315f414))
* **init:** align guard help text and planner warning gating with spec ([e854d24](https://github.com/adam-s-k-i/super-backlog/commit/e854d247bb420b812d96f6de08b310e86407eadd))
* **init:** guard strictly opt-in per spec D8; YAML config stub ([5026f04](https://github.com/adam-s-k-i/super-backlog/commit/5026f04ea157b54e070064c5cbe28b42744f5a50))
* **lib:** correct KIT_VERSION package resolution ([7798d4c](https://github.com/adam-s-k-i/super-backlog/commit/7798d4c5a18e23c94fee6e5b5abe0867774a195f))
* **lib:** scope stripOwned whitespace collapse to removal junction ([de67d67](https://github.com/adam-s-k-i/super-backlog/commit/de67d674870e1d18a4d194128be08280df9f7264))
* **readme:** show logo as hero; link intro video (GitHub cannot embed repo mp4s) ([a90a3df](https://github.com/adam-s-k-i/super-backlog/commit/a90a3df775acb763c409ebbcb914a91269a2bcfd))
* **release:** grant caller job permissions for reusable publish workflow ([0a7a399](https://github.com/adam-s-k-i/super-backlog/commit/0a7a39979e22ecb9efe0e6e8c316c3a80a826de2))
* **scripts:** drop shebangs - vite transform chokes on shebang+CRLF, invocation is node scripts/x.mjs anyway ([1ed637a](https://github.com/adam-s-k-i/super-backlog/commit/1ed637a80279637d98c8db9f6f90b9bc92df0876))
* **test:** docs guard paths after guide migration ([7603ba3](https://github.com/adam-s-k-i/super-backlog/commit/7603ba333f7b2d560cfacf782c60709bfc8d018a))

## [0.1.0] - 2026-08-26

First release of the core kit (v1 MVP scope).

### Added

- `sbl init` — one-command installation into any project: `backlog.md@latest` + `super-backlog@latest` devDependencies, upstream `backlog init --defaults`, OpenCode plugin entry, Claude marketplace setup (automatic or printed instructions), marker-scoped workflow block in `AGENTS.md`, `CLAUDE.md` pointer, file-based `spec-to-backlog` skill for both harnesses, merged npm scripts (`tasks`, `board`, `browser`, `dashboard`), first Project Dashboard generation; flags `--pm`, `--harness`, `--guard`, `--no-dashboard`, `--dry-run`; idempotent re-runs.
- `sbl uninstall` — ownership-proven removal with a removed/kept/skipped report; Backlog task data preserved unless `--with-backlog`.
- `sbl update` — refreshes injected glue files to the installed kit version and compares installed vs. published upstream versions.
- `sbl dashboard` — generates the single-file Project Dashboard (`dashboard.html`) from Backlog data; `--serve` live mode on port 6428, `--port`, `--no-open`, `--out`.
- Optional integrity guard hook (`--guard`): structural pre-commit validation of staged task files.
- Exit code contract 0–4 and test seams `SBL_SKIP_INSTALL=1` / `SBL_FORCE_OFFLINE=1`.
- Documentation set: architecture, harness support, guard hook, troubleshooting guides.

[0.1.0]: https://github.com/adam-s-k-i/super-backlog/releases/tag/v0.1.0
