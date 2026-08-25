# Guard hook

`sbl init --guard` installs an opt-in pre-commit hook into `.git/hooks/pre-commit` (appended as a marker-delimited block, so pre-existing hook content is preserved). It is POSIX sh and runs under Git for Windows' bundled `sh` as well.

## What it validates

The hook inspects staged changes under `backlog/tasks/**.md` and rejects the commit if any staged task file fails a structural check:

- **frontmatter parses** — the file must start with a `--- … ---` block
- **id matches filename** — the frontmatter `id:` must equal the filename without extension (catches copy-pasted or renamed files)
- **title non-empty** — the frontmatter `title:` must be present and non-empty

These checks catch accidental or faulty hand edits at commit time without interfering with normal `backlog` CLI usage: anything written by the CLI passes trivially.

## Escape hatch

```
git commit --no-verify
```

skips the hook entirely. This is the documented escape hatch for legitimate edge cases; the rejection message prints it too.

## Why not OS-level read-only?

Making task files read-only via OS attributes was evaluated and rejected: the backlog CLI and manual editors run under the same user identity, so read-only flags would break `backlog` itself and git checkout flows. Commit-time structural validation gives the protection without those side effects.
