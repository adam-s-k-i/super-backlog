---
name: project-profile
description: Create or revise backlog/docs/critical-areas.md, the project profile that names the areas where work always runs on the top tier. Use when the file is missing, the user asks for it, the project changed substantially, a misclassification caused a mistake, or sbl doctor reports the profile as provisional.
---

<!-- managed-by: super-backlog 1.9.0 -->
# Project Profile: name the critical areas of this project

Writes `backlog/docs/critical-areas.md`. The managed AGENTS.md block tells
every agent to read it at session start: everything it lists runs on the top
tier, and everything under "Independent check" is verified by a second
subagent before use. Guide:
<https://adam-s-k-i.github.io/super-backlog/guide/project-profile>.

## When this skill runs

- `backlog/docs/critical-areas.md` is missing (offered once per block rule 8).
- The user asks for it.
- The project changed substantially: new modules, new risks, going live.
- A misclassification caused a mistake.
- A provisional profile can now be judged better, or `sbl doctor` reports it
  as provisional.

## Procedure

1. Tier check. Assessment and wording are top-tier work only. If the session
   runs on a lower tier, hand both to a subagent on the top tier; fact
   gathering (step 2) may go to Light or Standard. If no top-tier model is
   available, write a draft, end the Status line with `provisional`, and tell
   the user once that it should be revised with the strongest model.
2. Targeted overview, no full reading: project description, existing
   instructions (AGENTS.md, CLAUDE.md), README, directory layout, central
   modules, and `backlog/docs/architecture.yml` if present.
3. Guiding question: where would a mistake go unnoticed and be costly or hard
   to reverse? Check at least: money, law, security and credentials, data loss
   and other irreversible actions, external visibility, decision-relevant
   metrics, structural choices with long-term consequences.
4. Look specifically for work that looks like routine but silently determines
   results; the general tier rule does not catch these cases.
5. Name explicitly what may go to lower tiers.
6. If the project is too empty to judge, derive the profile from the user's
   description and mark it `provisional`.
7. Write `backlog/docs/critical-areas.md` in this format, at most 150 words
   below the Status line, 4 to 7 items grouped by risk area (not by activity),
   `Independent check:` only when something is irreversible:

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

   The Status line holds the date and the model that wrote the file; append
   `provisional` only in the cases above.
8. Show the file once and STOP until the user approves it. If the file cannot
   be written, print it and ask the user to add it.

## Maintenance

Do not re-check the profile every session. Revise it, on the top tier, only on
the triggers listed under "When this skill runs".

## Boundaries

- Only touch `backlog/docs/critical-areas.md`.
- Never invent risks the project does not show; every item names something
  real in the project.
- Keep the 150-word limit; English heading and keys, body in the language the
  user works in.
- Never downgrade something the user marked as critical.
