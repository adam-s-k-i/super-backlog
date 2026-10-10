---
type: how-to
---

# Project profile

`backlog/docs/critical-areas.md` names the parts of a project where a mistake
would go unnoticed and be costly or hard to reverse. The managed `AGENTS.md`
block tells every agent to read it at session start: whatever it lists always
runs on the top model tier, and whatever it lists under "Independent check" is
verified by a second subagent before the result is used. See
[Harness support](harness-support#model-tiers-and-delegation-all-harnesses)
for the tier rule itself.

## Format

English heading and keys, body in the language you work in, at most 150 words
below the Status line, grouped by risk area rather than by activity:

```markdown
# Critical areas

Status: 2026-10-10, created with Fable 5.1, provisional

Always on the top tier:
- Payments: refund flow in src/billing, Stripe webhook handlers
- Data loss: migrations in db/migrate, anything deleting customer records
- Credentials: .env handling, OAuth token storage
- Public release: npm publish, release notes

Independent check: migrations, release publishing

May go to lower tiers: UI copy, test fixtures, docs, formatting, lookups
```

- `Always on the top tier:` holds 4 to 7 items with concrete examples.
- `Independent check:` lists irreversible operations; leave the line out when
  there are none.
- `May go to lower tiers:` names uncritical kinds of work so that not
  everything gets escalated.
- `provisional` at the end of the Status line means the profile was drafted
  below the top tier or from a description only and should be revised on the
  top tier. The Status line is the only part of the file that `sbl` reads.

## Creating it

Let your agent write it. `sbl init` and `sbl update` install the
`project-profile` skill for Claude Code and OpenCode, and the block's rule 8
makes the agent offer it once while the file is missing — it never runs
without your consent. The skill does the assessment on the top tier (or hands
it to a top-tier subagent), gathers facts from your instructions, README,
layout and central modules, writes the file and stops for your review. While
the file is missing, `sbl init` ends with a hint to ask your agent for it.

## Keeping it current

The profile is not re-checked every session. Ask for a revision when the
project changes substantially (new modules, new risks, going live), when a
misclassification caused a mistake, or when a provisional profile can now be
judged better.

```bash
sbl doctor
```

Check 6 reads the file: `[skip]` while it is missing, `[warn]` (exit 4) when
the Status line says `provisional` or is absent, `[ok]` otherwise. `sbl` never
writes or edits the file.
