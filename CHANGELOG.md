# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.3.3](https://github.com/adam-s-k-i/super-backlog/compare/v1.3.2...v1.3.3) (2026-08-30)


### Features

* **phase:** dashboard data layer maps labels and derives phase ([9c78693](https://github.com/adam-s-k-i/super-backlog/commit/9c786936f1c7c7484e154725f101ba18caa04fd2))
* **phase:** dashboard stepper badges, task phase chips, modal advance chip ([d60f392](https://github.com/adam-s-k-i/super-backlog/commit/d60f392b43ada19eea9afba2f23ec5b5626fcd0f))
* **phase:** doctor hygiene checks for phase labels with fail status ([230e91d](https://github.com/adam-s-k-i/super-backlog/commit/230e91d25f10707bc47b9597705a794c22d61d13))
* **phase:** e2e coverage, pipeline-phases guide, dogfood refresh ([8689f71](https://github.com/adam-s-k-i/super-backlog/commit/8689f71ec63fb302d58e3d797c3c9ac922801b2f))
* **phase:** pure phase-label model and transition validation ([c3c02cd](https://github.com/adam-s-k-i/super-backlog/commit/c3c02cd37bb69d45f027525d0758ff6ac342b548))
* **phase:** sbl phase command with validated label transitions ([8944f14](https://github.com/adam-s-k-i/super-backlog/commit/8944f1480f366418fff157ccefc2161d724e9cea))
* **phase:** teach phase labels in workflow block and glue skills ([59d920d](https://github.com/adam-s-k-i/super-backlog/commit/59d920d576d35c0aea8d53e81447aa9cc2ea7dcf))


### Miscellaneous Chores

* pin next release ([aa54611](https://github.com/adam-s-k-i/super-backlog/commit/aa54611bf4b1b7616971ba351f35fe38707d4c00))

## [1.3.2](https://github.com/adam-s-k-i/super-backlog/compare/v1.3.1...v1.3.2) (2026-08-30)


### Features

* **dashboard:** restart outdated hubs on attach and add sbl db alias ([ee47a8f](https://github.com/adam-s-k-i/super-backlog/commit/ee47a8f925840e2a19316b250e0360eae29ace1d))
* **update:** self-update the CLI before refreshing managed files ([6e9544b](https://github.com/adam-s-k-i/super-backlog/commit/6e9544b9a09eccc25a6a7cef649c0f15f5e50221))


### Bug Fixes

* **update:** case-insensitive install detection on windows; hermetic wiring tests ([e324843](https://github.com/adam-s-k-i/super-backlog/commit/e324843f0b13948991fb0501122e35a1d3996a1d))
* **update:** hermetic published-version probe seam for unit tests ([faab861](https://github.com/adam-s-k-i/super-backlog/commit/faab861d9ef8ace16c98c185b9fe7b39c9627d59))
* **update:** skip self-update under SBL_FORCE_OFFLINE; docs for self-update, db alias and hub restart ([1469875](https://github.com/adam-s-k-i/super-backlog/commit/1469875ab3d259143824b531eeb1ed65034893e5))


### Miscellaneous Chores

* pin next release ([c80e770](https://github.com/adam-s-k-i/super-backlog/commit/c80e770a3e66177c6b8fb985ed794964dd7885e1))

## [1.3.1](https://github.com/adam-s-k-i/super-backlog/compare/v1.3.0...v1.3.1) (2026-08-30)


### Features

* **dashboard:** 26-week activity buckets with touched task ids ([d8b6bf5](https://github.com/adam-s-k-i/super-backlog/commit/d8b6bf5bfacd19b147a38d5754649a834b905cf1))
* **dashboard:** activity calendar heatmap with day drill-down and KPI strip ([579f2b7](https://github.com/adam-s-k-i/super-backlog/commit/579f2b7e7473ba55712b0038773410321c521776))
* **dashboard:** draft cards with full detail modal ([cc19af7](https://github.com/adam-s-k-i/super-backlog/commit/cc19af7629719b14a7aa6f35bbbecf4c2da38f5a))
* **dashboard:** natural task sorting, status badges and locale-aware updated column ([9c970d7](https://github.com/adam-s-k-i/super-backlog/commit/9c970d7debc7a532f9c3630dbc91e3359ef157db))
* **dashboard:** reorder sections, promote model router to command button, dedicated drafts section ([1f25efb](https://github.com/adam-s-k-i/super-backlog/commit/1f25efb444ebf1df3746c7164b508eea033ed668))
* **dashboard:** server-side KPI metrics (progress, velocity, wip, age, activity) ([3f63b00](https://github.com/adam-s-k-i/super-backlog/commit/3f63b00f4680ec259ce5e302e93d06057499410d))
* **dashboard:** status KPI tiles with wip/blocked filters and aging strip ([fed6c95](https://github.com/adam-s-k-i/super-backlog/commit/fed6c95bc3f75f7d63b7b009ee90bd456707ec96))
* **dashboard:** switch typography to Plus Jakarta Sans + JetBrains Mono ([388dcc3](https://github.com/adam-s-k-i/super-backlog/commit/388dcc320f5b49b02efa969a68518ca89b09e35a))
* **dashboard:** task created date and enriched draft details in the data layer ([4eabfa7](https://github.com/adam-s-k-i/super-backlog/commit/4eabfa7be14357fead772eb72731cc96d3887560))
* **dashboard:** tokenize colors, add light theme with persistent toggle ([7995d12](https://github.com/adam-s-k-i/super-backlog/commit/7995d125d95d7c9554a44b4db7f289c373867000))


### Bug Fixes

* **dashboard:** clickable blocked filter in the wip kpi tile ([8414519](https://github.com/adam-s-k-i/super-backlog/commit/84145198a465f7f003a8eb2727358a5bbb94b721))
* **dashboard:** final review fixes (README fonts claim, review-status containment, dead code, noon convention) ([84c4afc](https://github.com/adam-s-k-i/super-backlog/commit/84c4afc15fe75aaa512dcbe6b0faa95c08b16913))
* **dashboard:** raise dark-theme --dim to WCAG AA contrast ([9aa5ba6](https://github.com/adam-s-k-i/super-backlog/commit/9aa5ba6e4c03af1da53b7a1bebb83e4882669e75))


### Miscellaneous Chores

* pin next release ([ab01b85](https://github.com/adam-s-k-i/super-backlog/commit/ab01b858c66b82cc956212eae10e37902d2cd34c))

## [1.3.0](https://github.com/adam-s-k-i/super-backlog/compare/v1.2.0...v1.3.0) (2026-08-29)


### Features

* centered, detailed task dialog and modern CLI field mapping ([#49](https://github.com/adam-s-k-i/super-backlog/issues/49)) ([#50](https://github.com/adam-s-k-i/super-backlog/issues/50)) ([4f02ebb](https://github.com/adam-s-k-i/super-backlog/commit/4f02ebbabd92ff576629098921024012f42889db))
* **dashboard:** enrich task details from task markdown files ([#53](https://github.com/adam-s-k-i/super-backlog/issues/53)) ([f990626](https://github.com/adam-s-k-i/super-backlog/commit/f990626f0af86a11d2f0df2193e12c0eb670485f))
* model router modal with enable/disable endpoints ([#54](https://github.com/adam-s-k-i/super-backlog/issues/54)) ([3d4053c](https://github.com/adam-s-k-i/super-backlog/commit/3d4053c79887571eb242b1ef9d94821c98211c85))

## [1.2.0](https://github.com/adam-s-k-i/super-backlog/compare/v1.1.1...v1.2.0) (2026-08-29)


### Features

* compact clickable feature-cycle stepper and sidebar update badge ([#46](https://github.com/adam-s-k-i/super-backlog/issues/46)) ([12cbf06](https://github.com/adam-s-k-i/super-backlog/commit/12cbf06407446869767b852f66cb7a703d349846))
* single Backlog button opens the Backlog.md UI in a managed overlay ([#48](https://github.com/adam-s-k-i/super-backlog/issues/48)) ([e5054a8](https://github.com/adam-s-k-i/super-backlog/commit/e5054a87b90bd628f66e225a7a7ea72f179ad867))

## [1.1.1](https://github.com/adam-s-k-i/super-backlog/compare/v1.1.0...v1.1.1) (2026-08-29)


### Bug Fixes

* hub hardening and symlink-safe CLI entry (post-1.1.0 review fixes) ([#43](https://github.com/adam-s-k-i/super-backlog/issues/43)) ([7823d58](https://github.com/adam-s-k-i/super-backlog/commit/7823d583a7e361b5d4de7a9570bba4f56f3e08ab))

## [1.1.0](https://github.com/adam-s-k-i/super-backlog/compare/v1.0.3...v1.1.0) (2026-08-29)


### Features

* **cli:** dashboard hub, drop aliases, version hint ([#40](https://github.com/adam-s-k-i/super-backlog/issues/40)) ([4d2b289](https://github.com/adam-s-k-i/super-backlog/commit/4d2b2895963e4a6a95ce6a5e19444f3d39ac6c63))

## [1.0.3](https://github.com/adam-s-k-i/super-backlog/compare/v1.0.2...v1.0.3) (2026-08-28)


### Bug Fixes

* **deps:** pin vitest peer esbuild to ^0.25.0 to keep lock cross-platform ([5a06d13](https://github.com/adam-s-k-i/super-backlog/commit/5a06d13eed44b4472ffc98c9d757e8bc4f32705e))

## [1.0.2](https://github.com/adam-s-k-i/super-backlog/compare/v1.0.1...v1.0.2) (2026-08-28)


### Bug Fixes

* regenerate package-lock.json to include missing peer dependency ([99bd371](https://github.com/adam-s-k-i/super-backlog/commit/99bd371899cb620e610e64425ca9ef083a2e5fda))

## [1.0.1](https://github.com/adam-s-k-i/super-backlog/compare/v1.0.0...v1.0.1) (2026-08-28)


### Bug Fixes

* replace shell:true spawns with cross-spawn to silence DEP0190 ([23a061e](https://github.com/adam-s-k-i/super-backlog/commit/23a061ef5b50d7ecbc27127d1f9c26c785bbc132))

## [1.0.0](https://github.com/adam-s-k-i/super-backlog/compare/v0.10.2...v1.0.0) (2026-08-28)


### ⚠ BREAKING CHANGES

* make sbl dashboard serve-only and remove static project dashboard

### Features

* make sbl dashboard serve-only and remove static project dashboard ([c3fee87](https://github.com/adam-s-k-i/super-backlog/commit/c3fee87f34568d966c4e2ffec1c5201f149ced05))

## [0.10.2](https://github.com/adam-s-k-i/super-backlog/compare/v0.10.1...v0.10.2) (2026-08-28)


### Bug Fixes

* **dashboard:** quick-action static fallback, card restyle and CORS ([78ca1c4](https://github.com/adam-s-k-i/super-backlog/commit/78ca1c49434dc4479654392eebf6ad2eb6898456))

## [0.10.1](https://github.com/adam-s-k-i/super-backlog/compare/v0.10.0...v0.10.1) (2026-08-27)


### Bug Fixes

* **test:** make backlog-alias tests cross-platform ([9fef678](https://github.com/adam-s-k-i/super-backlog/commit/9fef678a9d2ba772ca5a57f39ec76e5821bb29e5))

## [0.10.0](https://github.com/adam-s-k-i/super-backlog/compare/v0.9.0...v0.10.0) (2026-08-27)


### Features

* **dashboard:** modal details, Inter font, flow view; sbl aliases; drafts; quick actions; task count fix ([f4bdd4a](https://github.com/adam-s-k-i/super-backlog/commit/f4bdd4a0a1f661048c779083e21954f91f6b1e8d))
* **serve:** live-sync dashboard with SSE and sbl serve command ([a9f88dc](https://github.com/adam-s-k-i/super-backlog/commit/a9f88dc96f49ec18caa7b0dd9f5b56b5275b4e99))

## [0.9.0](https://github.com/adam-s-k-i/super-backlog/compare/v0.8.1...v0.9.0) (2026-08-27)


### Features

* **docs:** auto-refresh README dashboard screenshot from curated demo data ([91373c4](https://github.com/adam-s-k-i/super-backlog/commit/91373c42781b5635af672f5ec466cb75ddf6bac9))
* **init:** scaffold minimal package.json when absent ([25ccd83](https://github.com/adam-s-k-i/super-backlog/commit/25ccd83756bdacd62e6add6cf0ea3d7531efefdf))


### Bug Fixes

* **dashboard:** fall back to directory name for project identity ([359a122](https://github.com/adam-s-k-i/super-backlog/commit/359a12234586017dbaff78b9d5b90c1349dcced3))
* **docs:** dashboard links bypass SPA router, installer URLs use master ([7fdaad9](https://github.com/adam-s-k-i/super-backlog/commit/7fdaad9304b88af740804eedafcdbc9fd8ed53ee))

## [0.8.1](https://github.com/adam-s-k-i/super-backlog/compare/v0.8.0...v0.8.1) (2026-08-27)


### Bug Fixes

* **deps:** resolve Dependabot alerts in vitepress/vite/esbuild chain ([388f811](https://github.com/adam-s-k-i/super-backlog/commit/388f8119433ebefd3f052beca8cab10d2ea31638))
* harden docs freshness gate (sidebar matching, parsing edge cases, error reporting) ([#27](https://github.com/adam-s-k-i/super-backlog/issues/27)) ([43c1d77](https://github.com/adam-s-k-i/super-backlog/commit/43c1d776da5fd188e968e36dc9064e880df41ba8))

## [0.8.0](https://github.com/adam-s-k-i/super-backlog/compare/v0.7.0...v0.8.0) (2026-08-27)


### Features

* add docs freshness gate (CI gate, style guide, type frontmatter) ([#25](https://github.com/adam-s-k-i/super-backlog/issues/25)) ([94431b7](https://github.com/adam-s-k-i/super-backlog/commit/94431b77f9dd0ae927f027885223c0e543187296))

## [0.7.0](https://github.com/adam-s-k-i/super-backlog/compare/v0.6.0...v0.7.0) (2026-08-27)


### Features

* **install:** self-healing install and uninstall flows ([e289989](https://github.com/adam-s-k-i/super-backlog/commit/e289989942092861a0f188fa842f4bef35ebb389))


### Bug Fixes

* **test:** align preflight shim probe with the faked win32 platform ([c291701](https://github.com/adam-s-k-i/super-backlog/commit/c2917011c0ef5ba26566e1bca2f6a4bbc8aac003))
* **test:** make preflight unit tests platform-agnostic ([8272165](https://github.com/adam-s-k-i/super-backlog/commit/8272165d382f861546fb4f5a698b7fe13432d4ae))
* **test:** raise vitest testTimeout to 30s for spawn-heavy e2e ([ee8e6b8](https://github.com/adam-s-k-i/super-backlog/commit/ee8e6b81ab8853cad4a6e07558140095bcef4cd5))

## [0.6.0](https://github.com/adam-s-k-i/super-backlog/compare/v0.5.0...v0.6.0) (2026-08-27)


### Features

* **install:** add cross-platform installer scripts and update docs ([e22216c](https://github.com/adam-s-k-i/super-backlog/commit/e22216ce63e4aea26950d32a85b80be8695f08ac))


### Bug Fixes

* **test:** stabilize activity date assertion against real current date ([55da1ed](https://github.com/adam-s-k-i/super-backlog/commit/55da1ed9b995acc4c8bb74c9eb5226f3b038fabc))

## [0.5.0](https://github.com/adam-s-k-i/super-backlog/compare/v0.4.0...v0.5.0) (2026-08-26)


### Features

* **claude:** install cc agents and session-start sync hook ([751089e](https://github.com/adam-s-k-i/super-backlog/commit/751089ea64b299064eea03e7011e374e7fc03349))
* **cli:** add sbl models commands and init --models opt-in ([157cd6a](https://github.com/adam-s-k-i/super-backlog/commit/157cd6a62f83bccbb7f29e1da9fe5c3b9127c7ea))
* **dashboard:** expose model-router API endpoints in serve mode ([d9243e3](https://github.com/adam-s-k-i/super-backlog/commit/d9243e32ff25f338d8a29c0fba1f80e8bea5f989))
* **models:** add discovery helper for opencode model tiers ([42faf22](https://github.com/adam-s-k-i/super-backlog/commit/42faf22a3c9b549747d98d062a3f88b9032c59e9))
* **opencode:** install model-router plugin and tier agents ([8f64eaf](https://github.com/adam-s-k-i/super-backlog/commit/8f64eaf26b0c794a3fe7120fa5b524ed3d4b4bd0))
* **uninstall:** remove model-router artifacts with ownership report ([7685159](https://github.com/adam-s-k-i/super-backlog/commit/768515980acc7af2f7fcd26d17bf4b0f2445fd53))


### Bug Fixes

* **claude:** guard session hook and clean test imports ([bc05906](https://github.com/adam-s-k-i/super-backlog/commit/bc0590666b0f74694b3d6d83682651d548a7da68))
* **claude:** point SessionStart hook at shipped template path ([ede43e1](https://github.com/adam-s-k-i/super-backlog/commit/ede43e1ac413bd9f245b6c6182c682b7e4cc7ab7))
* **cli:** correct models subcommand routing and preserve config ([bc8f2b3](https://github.com/adam-s-k-i/super-backlog/commit/bc8f2b3105435438d06f61a11f2ecbc92727871a))
* **models:** catch discovery failures and return null ([7011d44](https://github.com/adam-s-k-i/super-backlog/commit/7011d449fec8f23455f089b0018b9a330faa6304))
* **opencode:** use package-name dynamic imports in plugin ([525d53a](https://github.com/adam-s-k-i/super-backlog/commit/525d53a51ca19eeda88b007ea7c2abd0c8b50283))
* **uninstall:** restore backlog/ kept message ([dd51d47](https://github.com/adam-s-k-i/super-backlog/commit/dd51d475ecae3616ae9c74b6dcf8bf2a7f9b4bee))

## [0.4.0](https://github.com/adam-s-k-i/super-backlog/compare/v0.3.4...v0.4.0) (2026-08-26)


### Features

* **models:** add shared config, family tables and tier resolver ([110428d](https://github.com/adam-s-k-i/super-backlog/commit/110428de1d7fedf422d4c65902ae783174f01ce3))

## [0.3.4](https://github.com/adam-s-k-i/super-backlog/compare/v0.3.3...v0.3.4) (2026-08-26)


### Bug Fixes

* **ci:** checkout repo before reading package.json in release verification step ([bc60720](https://github.com/adam-s-k-i/super-backlog/commit/bc607206583d856073a784379c55cff3258e8a0f))
* **ci:** pass repository secrets to publish reusable workflow ([156ba63](https://github.com/adam-s-k-i/super-backlog/commit/156ba63f743ed97b57ce392147428e2580f1b7bc))

## [0.3.3](https://github.com/adam-s-k-i/super-backlog/compare/v0.3.2...v0.3.3) (2026-08-26)


### Bug Fixes

* **ci:** verify release exists before deciding to run Publish job ([9e3ce9f](https://github.com/adam-s-k-i/super-backlog/commit/9e3ce9f3f5b45ddce02d6620ee9cc944af3f04c5))

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
