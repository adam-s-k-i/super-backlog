---
name: architecture-summary
description: Create or refresh backlog/docs/architecture.yml, the curated source of the project summary page (architecture diagram, flows, highlights, tech stack, commands). Use when the user asks for a project summary, an architecture overview or diagram, or after structural changes to the codebase.
---

# Architecture Summary: curate the project summary page

Writes `backlog/docs/architecture.yml`. The dashboard hub renders it at
`/p/<slug>/summary/` next to facts it computes itself (versions, LOC, tests,
releases, CI, open work). Schema and YAML subset:
<https://adam-s-k-i.github.io/super-backlog/guide/project-summary>.

## When this skill runs

- The user asks for a project summary, an architecture overview or a diagram.
- The summary page shows "No architecture file yet".
- After structural changes: new modules, removed components, renamed commands.

## Procedure

1. Read the facts first: manifests (`package.json`, `composer.json`, WordPress
   headers in `style.css` or the main plugin file), the top-level directory
   layout, the entry points, and the test layout.
2. If `backlog/docs/architecture.yml` exists, read it. Keep curated prose
   (`pitch`, `purpose`, `why`, highlight texts) unless the code contradicts it;
   change only what is outdated or missing.
3. Propose the content:
   - `pitch`: one or two sentences, `**bold**` is the only markup.
   - 6 to 14 `nodes` with `kind`, a short `label`, an optional `sub`,
     `purpose`, `why`, real `files` and real `commands`. Keep `label` at 18
     characters or fewer and `sub` at 20 or fewer so they fit the node box;
     28 and 32 are only the hard schema limits, and longer text is clipped
     with an ellipsis.
   - `zones` that group nodes by layer; zones may not overlap.
   - `edges` that read "from → label → to" (the source uses, calls or writes
     the target).
   - 3 to 5 `flows` that walk existing edges, each step written as `from>to`.
   - 4 to 6 `highlights`, at most one per node.
   - `stack`, `commands` and `tasks` (open task id → node id) where they help.
4. Place nodes on the `grid` so that every edge is a straight line or has a
   single corner: connected nodes share a row or a column, or the corner cell
   between them stays free.
5. Write the file with two-space indentation, no tabs, and quote every value
   that contains a comma, a colon followed by a space, or a `#`.
6. Run `sbl doctor`. Check 5 validates the file and prints every problem with
   its path, plus the layout warnings (`route-fallback`, `label-collision`,
   `crossing`). Fix the file and run `sbl doctor` again until check 5 reports
   `[ok]`.
7. Present the diff of `backlog/docs/architecture.yml` for review and STOP
   until the user approves the prose. Point to the live page:
   `sbl dashboard`, then the **Summary** tab.

## Boundaries

- Never invent files, commands, packages or versions: every path in `files`
  must exist, every `run` must be a command that works in this project.
- Keep `purpose` and `why` under three sentences each.
- The hub computes the facts (versions, LOC, tests, releases, CI); never copy
  them into the file.
- Write curated text in the language the user works in; keys stay English.
- Only touch `backlog/docs/architecture.yml`; never edit tasks or other
  backlog files.
