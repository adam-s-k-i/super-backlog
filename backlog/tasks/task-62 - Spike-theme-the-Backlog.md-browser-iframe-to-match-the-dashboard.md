---
id: TASK-62
title: 'Spike: theme the Backlog.md browser iframe to match the dashboard'
status: Done
assignee:
  - '@adamh'
created_date: '2026-08-29 23:47'
updated_date: '2026-09-24 18:12'
labels:
  - dashboard
dependencies: []
references:
  - docs/superpowers/specs/2026-08-30-dashboard-redesign-v2-design.md
type: spike
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feasibility question, output is a recommendation not code: can the hub proxy the backlog browser under its own origin and inject dashboard CSS tokens reliably (live-reload, absolute paths, version drift of Backlog.md internals), or does Backlog.md offer upstream theming? Cross-origin iframe (own port) makes direct injection impossible.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Upstream theming options of Backlog.md checked and documented
- [x] #2 Proxy + style-injection approach prototyped or ruled out with reasons
- [x] #3 Recommendation with effort estimate reported; any prototype code labeled throwaway
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Check Backlog.md >=1.52 upstream for browser theming options (changelog, config, source). 2. Read the hub backlog-browser integration code (how the iframe URL is built today). 3. Prototype hub-side proxy + CSS token injection (throwaway) or rule it out with reasons. 4. Write recommendation with effort estimate into task notes; label any prototype throwaway.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC1 evidence (upstream theming, backlog.md 1.53.0): browser has built-in light/dark only (localStorage key 'backlog-theme', .dark class on <html>, honors prefers-color-scheme; anti-flash script inline in served HTML). No theme flag on 'backlog browser --help', no theme keys in backlog/config.yml, no theming API. CSS is a compiled Tailwind v4 bundle (155KB, palette-level vars like --color-gray-*, --font-sans); --buncss-light/dark cover only the markdown editor syntax theme. => no upstream custom theming; chunk hashes (chunk-j99g18zw.css) churn per release.

AC2 evidence (proxy + injection, throwaway prototype): cookie-routed reverse proxy proven end-to-end with the real 'backlog browser' (prototype in C:\Users\adamh\AppData\Local\Temp/opencode/task62-proxy-spike.mjs, labeled throwaway, not in repo). Mechanism: hub route /p/<slug>/bb/ sets cookie sbl_bb=<slug> and proxies the browser root; all absolute SPA paths (/chunk-*.css, /assets, browser /api) hitting hub root are routed by that cookie to the right project's spawned browser. Verified: page 200 via hub origin, 155KB chunk CSS served through hub (200), wrong-cookie request 404 (multi-project isolation). No HTML/base rewriting needed, path-agnostic forwarding => low version drift. Same-origin iframe then enables trivial theme sync (contentWindow.localStorage.setItem('backlog-theme',...)) and optional CSS var overrides.

AC3 recommendation: GO in two phases. Phase 1 (recommended, ~0.5-1d): same-origin proxy in the real hub + light/dark sync with the dashboard theme toggle - low risk, big consistency win, uses upstream's own dark theme instead of fighting it. Phase 2 (optional, +0.5-1d): map dashboard tokens onto the browser's Tailwind palette vars (--font-sans, --color-gray-*) via injected style for full brand match; cosmetic-only drift risk because Tailwind classes churn across releases. Avoid: deep DOM restyling (fragile against version drift). Effort estimate: Phase 1 alone delivers the visible value.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Spike answered: Backlog.md 1.53 offers no custom theming (light/dark only); hub-side same-origin proxy with cookie-based SPA routing is proven viable with the real browser (throwaway prototype, verified 200/200/404 isolation). Recommendation: Phase 1 proxy + theme-mode sync (~0.5-1d), optional Phase 2 token overrides (+0.5-1d, cosmetic drift risk only).
<!-- SECTION:FINAL_SUMMARY:END -->
