# Summary Hardening Design (TASK-93..97)

Addendum to `2026-10-09-project-summary-design.md` and
`2026-10-10-summary-drift-design.md`. It records one decision per acceptance
criterion of TASK-93 (YAML subset), TASK-94 (schema), TASK-95 (facts),
TASK-96 (layout) and TASK-97 (render, hub, doctor, tests).

## Goal

Close the review findings on the project summary chain without changing what a
valid `backlog/docs/architecture.yml` renders today. The work has three parts:

- Ambiguous YAML is rejected with a line-numbered error, and every harmless
  normalisation that remains is documented.
- The schema and layout code is split into named steps with identical output.
- The I/O edges become defensive: file sizes, git failures, temporary files and
  write errors.

## Non-goals

- No full YAML parser and no new YAML features.
- No new layout algorithm. Routing (L3) and label candidates (L5 slots) stay
  as they are.
- No change to the curated file format or to `schema: 1`.
- No change to the hub registry protocol.
- No change to the dashboard page beyond single-pass placeholders and the
  shared tokens CSS.

## TASK-93: YAML subset (`src/lib/yamlmini.ts`)

**#1, ambiguous inputs.** Each case below is either rejected with
`line L, column C: reason`, where columns are 1-based, or accepted and
documented.

| Input | Decision | Error (verbatim reason) and column |
| --- | --- | --- |
| `a: x:` | reject | `plain values must not end with ":" - quote the value`, column 5 |
| `a: - x` | reject | `plain values must not start with "- " - quote the value or put block sequence items on the next lines`, column 4 |
| `a: -` | reject | same reason as `- x`, column 4 |
| `a: [a]#x` | reject | `unexpected text after flow collection`, column 7 |
| `a: "x"#y` | reject | `unexpected text after quoted scalar`, column 7 |
| `a: { k: }` | reject (already today) | `empty entry in flow collection`, column 9 |
| `a: -0` | accept, document | parsed as `0` (never `-0`) |
| trailing spaces in a `\|`/`>` block | accept, document | stripped from every content line |

- A shared helper `plainProblem(raw)` applies the ":"-ending and "- "-starting
  rules. Both `plainBlockScalar` (block context) and `FlowReader.readScalar`
  (flow context) call it, so `[x:]` and `[- x]` are rejected too.
- A `#` starts a comment only after whitespace, after a quoted scalar and after
  a flow collection as well as after a plain scalar. YAML itself has this rule,
  and it removes the `[a]#x` and `"x"#y` ambiguity.
- `resolvePlain` returns `n === 0 ? 0 : n`, so `-0` becomes `0`. A test asserts
  `Object.is(value, 0)`.
- Trailing spaces in literal blocks stay stripped, because the line reader
  trims them before block parsing. The guide documents this; the parser does
  not preserve them.
- The dogfood file and the skill template contain none of the rejected forms.
  The plan keeps `node dist/bin.js summary --check` green as proof.

**#2, missing tests.** These are added to `test/unit/yamlmini.test.ts`:

- Trailing garbage after a flow collection: `a: [a] b` at column 8 and
  `a: { k: v } x` at column 13.
- A `- |` literal as a sequence item, which gives `{ items: ['one\ntwo\n', 'b'] }`.
- Quoted mapping keys: `"a b": 1` and `'c': 2`.
- Text after a closing quoted scalar: `a: "x" y` at column 7.

**#3, timing bound.** The 256 KB linear-time test stops asserting 1000 ms. It
keeps a 10 s bound with a comment: the bound catches a quadratic regression
(minutes) without flaking on a slow CI runner.

**#4, guide.** The guide's YAML subset section names the reserved keys
`__proto__`, `constructor` and `prototype` and the nesting limit of 32. The
header comment of `yamlmini.ts` lists the same normalisations.

## TASK-94: schema (`src/dashboard/summary-schema.ts`)

**#1, refactor.** `validateArchitecture` becomes a sequence of section readers
that share one `Collector`:

- `readGrid`
- `readKinds` (exists)
- `readZones`
- `readNodes`
- `readEdges`
- `readFlows`
- `readHighlights`
- `readStack`
- `readCommands`
- `readTasks`

Each reader moves its section's lines verbatim. Messages, paths and the
problem order stay unchanged, and the existing tests stay unmodified. This is
a separate `refactor:` commit before any behaviour change.

**#2, single sources.**

- `ID_BODY = '[a-z][a-z0-9-]{0,31}'` is the one definition. `ID_RE` and
  `STEP_RE` are built from it with `new RegExp`.
- `ID_PATTERN_MESSAGE = 'must match ^[a-z][a-z0-9-]{0,31}$'` replaces the three
  literals. Kinds keep their `kind id ` prefix.
- `LIMITS.stackPackage = 214`, the npm package-name maximum, replaces the
  magic number.

**#3, no cascade.** `readNodes` returns `nodeIds: ReadonlySet<string> | null`.
The value is `null` whenever `c.list` rejected the list: `nodes` is missing,
not a list, longer than `LIMITS.nodes` or shorter than `LIMITS.nodesMin`.
With `null`, every node-reference check is skipped: edges, highlights, stack
nodes and tasks. The size error then stands alone. A `null` `edgeIds`, which
comes from the same conditions on `edges`, skips the flows' missing-edge
check.

**#4, flows.**

- An invalid or duplicate flow id is reported, but the reader still checks
  label, colour and steps. The flow is never kept.
- The default colour is `FLOW_COLORS[flows.length % FLOW_COLORS.length]`, so it
  is picked when a flow is accepted. A dropped flow no longer consumes a slot.
  The existing test colours `['accent', 'violet', 'warn']` stay: no flow is
  dropped there, and the counter counts accepted flows including those with
  explicit colours.

**#5, tests.** New tests cover:

- unknown-key warnings
- invalid id format
- a bad flow colour
- a non-boolean `dashed`
- a reversed zone range
- every string limit at exactly the limit and at one over it, table-driven
  from `LIMITS`
- seven command groups
- a 41-character group name
- nine commands in a group

## TASK-95: facts (`src/dashboard/summary-facts.ts`, `src/lib/run.ts`)

**#1, stat before read.** The LOC loop calls `statSync` first. It skips
anything that is not a regular file. When `bytes + st.size > maxBytes`, it
sets `locApprox` and continues without reading the file. A mocked
`readFileSync` test proves that the oversized file is never read.

**#2, buffer.**

- `runCapture` gains `opts.maxBuffer` with the default
  `RUN_CAPTURE_MAX_BUFFER = 64 * 1024 * 1024`. That covers about 50k paths of
  any realistic length, roughly 1000 bytes each.
- `RunResult` gains `errorCode?: string` from the spawn error, so `ENOBUFS` is
  visible to callers. A null status still maps to `127`.
- When `git ls-files` hits ENOBUFS, facts falls back to the walk and adds the
  warning `git ls-files: output exceeds the 64 MB buffer; files counted by a directory walk`.

**#3, git failure.** `gitFailure(r)` returns one of three notes:

- `'git output exceeds the 64 MB buffer'` for errorCode ENOBUFS
- `'git unavailable'` for status 127 or any other spawn error code
- `'not a git repository'` for any other non-zero status, for example 128

**#4, cleanup.**

- One exported `byCodeUnit(a, b)` comparator replaces the three inline sorts.
- `countWorkflows(cwd)` keeps one try/catch, and the redundant outer catch
  goes.

**#5, tests.** New tests cover:

- `licenseOf` with an array, which gives `'MIT OR Apache-2.0'`
- a CRLF `style.css` header with `Version: 1.4.0 */` on one line
- a theme-only project, which gives manifest `wordpress` and extensions
  `['.php']`
- `package.json` plus `composer.json`, which gives the JS extensions only

The misnamed test at line 88 is renamed to
`lets a theme style.css header fill the version composer.json lacks`.

## TASK-96: layout (`src/dashboard/summary-layout.ts`, `src/templates/summary.html`)

**#1, port overflow: clamp and warn (decision).** Port offsets are always
clamped into the box, and a warning is added when the clamp makes ports
crowded.

- The limit is `PORT_INSET = 8` px from each corner: `w/2 - 8 = 70` on T/B
  sides and `h/2 - 8 = 20` on L/R sides.
- A union-find group (sides joined by straight edges) gets one factor,
  `scale = min(1, min over its sides of limit / max|offset|)`, and every offset
  in the group is multiplied by it. One factor per group keeps straight edges
  at the same offset on both ends, which the H/V routes require.
- When `LAYOUT.port * scale < MIN_PORT_GAP` (6 px), the binding side emits
  `port-overflow`. The edge is the side's first port after sorting. The
  message is:
  `${n} connections on the ${side} side of ${node} leave ${gap}px between ports (minimum 6); move cells to spread the connections`,
  where side is `left|right|top|bottom` and gap has one decimal
  (`gap.toFixed(1)`), so 5.7 px is never shown as 6.
- Doctor check 5 lists layout warnings by code, so the warning surfaces as
  `layout port-overflow <edge>: <message>`.
- **Reason:** a warning alone still draws edges outside the box, and a clamp
  alone hides an unreadable diagram. Doing both keeps the drawing inside the
  box and still tells the author to move cells. Existing fixtures with two or
  fewer ports per L/R side and seven or fewer per T/B side are unchanged.

**#2, label scoring.**

- `foreignSegments` becomes every routed segment except the label's own
  segment, so the edge's other leg counts too.
- `scoreBox` gains `zoneLabels?: readonly Box[]` at +2 per hit, which is the
  same weight as a placed label.
- An exported `zoneLabelBox(z, tw)` returns
  `{ x0: z.x + 10, y0: z.y + 4, x1: z.x + 12 + tw, y1: z.y + 21 }`, matching
  the client's zone text at `(z.x + 12, z.y + 16)`.
- `segHitsBox`, `scoreBox` and `zoneLabelBox` move into the client's
  `sbl:badge-mirror` block. `rescoreLabels` uses them with the same foreign set
  and measured zone widths, falling back to `label.length * 7`.
- The drift test compares the server and mirror versions of all three.

**#3, rounding.** `routePolylines` rounds the points first and derives
segments from the rounded points, so `segment`, `points` and `d` agree.
Integer layouts are unchanged.

**#4, short segments (decision: document, no extra candidates).** The
dogfood `dev>cli` edge is a single H segment of 104 px (`LAYOUT.gx`). Slots on
that segment cannot hold a label wider than about 100 px, and a VH/HV detour
would add a crossing. The label becomes `sbl commands` (85 px, score 0)
instead of `runs sbl commands` (114 px, score 3). The reason is recorded in a
comment above `slotsFor` and here. A test asserts score 0 and the full label
for the dogfood `dev>cli` edge.

**#5, refactor.** `layoutArchitecture` becomes a pipeline of named steps:

- `placeNodes`
- `chooseRoutes` (L3)
- `assignPorts` (L4), which is `groupStraightSides`, `straightOffsets` and
  `placeSidePorts`
- `routePolylines`
- `placeLabels` (L5)
- `diagnose` (L6)
- `buildEdges`
- `layoutZones`
- `readingOrder`

The refactor commit changes no output. Two comments are added:

- `* half + 0` turns `-0` into `0`, so that `toEqual` and JSON output stay
  stable.
- The straight block trades -9/+9 offsets for alignment: a lone straight edge
  sits at `centre`, which can be +/-9 px off the box centre, so that it meets
  the opposite side at the same height.

**#6, overlap tests.** The overlap test re-scores every edge (not only flow
edges) with label widths scaled by 0.9 and 1.13 around `estimateLabelWidth`,
mimicking measured font widths. It asserts zero badge overlaps for all sources
and the synthetic graphs.

## TASK-97: render, hub, doctor, tests

**#1, write errors.** `writeSummaryPage` logs
`sbl: could not write the summary page ${file}: ${message}` to stderr when
`atomicWrite` throws, and still returns.

**#2, E3 fallback.**

- `buildSummaryModel` takes an optional `progress` object. The fallback
  reuses the facts and load result collected before the error. Facts are
  collected once, which a test checks by counting `ls-files` calls.
- `curatedSource(load, renderError)` keeps
  `No curated file yet ...` only when the load status is `missing`.
- Otherwise it says
  `backlog/docs/architecture.yml was not shown because the summary could not be rendered; see the notice above.`

**#3, single pass.** `fillTemplate(template, values)` replaces
`/__[A-Z][A-Z_]*__/g` in one pass. It looks values up with `Object.hasOwn`
and calls lazy functions, and unknown placeholders stay literal.
`renderSummary` and `renderDashboard` both use it. A project named
`__SBL_SUMMARY_JSON__` stays literal in the title.

**#4, shared code.**

- `tokensCss()` is exported from `render.ts` and used by both pages.
- The data-source lines use `plural()` for files, releases, components,
  connections, flows, highlights, stack entries, command groups and mappings.
- Dependencies keep `dependencies` when the total is not 1.

**#5, temp pages.** `removePageFiles(file)` deletes the page, its `.tmp`, the
summary sibling and its `.tmp`. It only acts on basenames matching
`/^sbl-dashboard-.*\.html$/i`, the names the hub and the CLI create in the
temp directory. The hub calls it when it disposes an entry (unregister,
`close()`) and when a re-registration changes the file path. A user file such
as `dash.html` is never deleted.

**#6, doctor guard.** The `layoutArchitecture` call is already guarded. The
`loadArchitecture` call gets the same guard: a throw becomes the fail line
`backlog/docs/architecture.yml check failed (${message})`.

**#7, tests.**

- The V2 test strips exactly `tokensCss()`, asserts that it appears once, and
  then checks the rest of the page for raw colours.
- The serve test asserts the 404 body `summary not generated yet`.
- The full-view snapshot becomes a structural skeleton:
  - the keys
  - the fact labels
  - the node, edge and flow ids
  - the layout node ids and edge `id:kind`
  - the zone labels
  - the warning count
  - task-to-node pairs
  - the command group sizes
  - the stack names
  - the source lines
- `test/unit/summary-client.test.ts` runs under `happy-dom` (version 20.14.6,
  devDependency). Rationale:
  - The repo has no DOM environment yet.
  - happy-dom has a handful of dependencies against about 20 for jsdom, and it
    starts faster.
  - A node:vm fake DOM would have to re-implement `closest`, `classList`,
    `querySelector` and events, which would test the fake instead of the page.
- The client test runs the page script and checks:
  - A flow chip click sets `aria-pressed` and adds the `flowing` class.
  - The hot edges are numbered.
  - The panel is filled.
  - A second click and Escape clear the selection.
  - The nav tabs mark Summary current.
  - Enter on a node selects it.

## Guide changes (`docs/guide/project-summary.md`)

The YAML subset section adds:

- The reserved keys `__proto__`, `constructor` and `prototype` are rejected.
- Collections may nest at most 32 levels.
- `-0` reads as `0`.
- Trailing spaces on lines of `|` and `>` blocks are removed.
- A `#` starts a comment only after a space, also after a quoted value or a
  flow collection.
- Plain values must not end with `:` or start with `- `. Quote them.
- Empty entries in flow collections (`{ k: }`, `[a, , b]`) are rejected.

Check 5's warning list adds "too many connections on one side of a box".

## Testing approach

- Write each change test-first in the matching unit test file.
- Run `npm test`, which builds first, before every commit.
- Run `npm run lint` when docs changed.
- After touching the guide or the dogfood file, also run
  `npx vitepress build docs` and `node dist/bin.js summary --check`.
- Refactor commits run against unmodified tests.
- Snapshot files rewritten with EOL-only changes are restored, never
  committed.
