# Drift: honest git failure wording (TASK-119)

Goal: the stale-file check in `src/dashboard/summary-drift.ts` stops calling
every failed `git log` "not a git repository". It reuses the classification
that PR #89 added to `src/dashboard/summary-facts.ts` (`gitFailure`).

## Classification (from `gitFailure`)

| Result of `git log` | Note |
|---|---|
| `errorCode === 'ENOBUFS'` | `stale-file skipped: git output exceeds the 64 MB buffer` |
| exit 127 or any `errorCode` | `stale-file skipped: git unavailable` |
| stderr matches `/not a git repository/i` | `stale-file skipped: not a git repository` |
| anything else | `stale-file skipped: git failed (<first stderr line>)`, no parentheses when stderr is empty |

The stderr detail is added at the drift call site; `gitFailure` itself stays
unchanged so the facts data-source line keeps its wording.

## Steps

1. Tests first (`test/unit/summary-drift.test.ts`, the "explains every skipped
   stale check" table): one row per branch above, including stderr with
   different casing, a spawn error code with a non-127 status, ENOBUFS, a
   "dubious ownership" failure with a multi-line stderr, and an empty stderr.
   Run them and see the new rows fail.
2. Implementation: in `staleFile`, replace the two status checks with
   `if (log.status !== 0) { notes.push(...gitFailure(log) + detail) }`, where
   detail is ` (<first trimmed stderr line>)` only for `'git failed'`.
   Import `gitFailure` from `./summary-facts.js` (no import cycle:
   summary-facts does not import summary-drift).
3. Gates: `npm test`, `npm run lint`, `npm run build`,
   `node dist/bin.js summary --check`.
4. Commit, push the branch, open a PR against master. Do not merge.
