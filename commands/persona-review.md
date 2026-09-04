---
description: Launch a task-specific persona panel for UI, product, or workflow review.
---

Use the `persona-lab` skill to run a persona panel for the request below.

Request:

```text
$ARGUMENTS
```

Execution rules:

- Recall before generating. Use the `persona` CLI to reuse saved work:
  `persona roster list`, `persona list`, `persona search "<query>"`. Scaffold
  the plan with `persona panel "<topic>" [--roster <name> | --auto]
  [--level low|medium|high]`. Generate new personas with `persona new` and
  `persona save` them so they are reusable. Levels: low = 3 to 4 lenses, single
  pass; medium = 4 to 6 lenses incl. required red-team, independent passes plus
  synthesis; high = 6+ lenses plus adversarial verification of critical
  findings.
- Select 4 to 6 distinct persona perspectives by MECE coverage of goals,
  jobs-to-be-done, and risk, not demographics. At least one must be an
  adversarial / red-team lens. This is required in every panel.
- Use current web research when role selection, market context, competitor
  references, regulations, pricing, or current company context could have
  changed.
- Verify what you can actually inspect: repo files, browser target, screenshots,
  data, logs, analytics, or user-provided artifacts.
- Do not claim UI testing, data inspection, or live research unless you ran the
  relevant tool or were given the artifact.
- Define measurements and per-persona anti-goals before launching the reviews.
- Freeze the artifact and record a `version` before any persona sees it. Passes
  that race builder edits produce findings about something that never existed.
- Ask everything in the first dispatch. A persona subagent is unreachable about
  thirty seconds after it finishes; there is no reliable follow-up turn.
- Run blind by default. An informed pass must name the prior `encounter_id`s the
  persona was shown; never mix blind and informed silently.
- Have each persona write its encounter before returning
  (`persona encounter new <persona_id> --artifact <slug>` → `... save -`), and
  collect the paths. See `docs/persona-memory.md`.
- Verify every reported defect against the artifact before treating it as real,
  and say plainly where a persona was mistaken. Reported defects are frequently
  silent gates rather than breakage. Use `persona-research-adjudicator`.
- Launch each persona pass independently and keep passes independent until
  synthesis, so distinct personas do not collapse into one voice. Instruct
  personas to abstain rather than fabricate. If subagents are available, launch
  one pass per persona; if not, run separate sequential passes with independent
  notes.
- Label each finding's provenance: evidence-grounded or assumption.
- Report back with the bottom line first, then findings, evidence, assumptions,
  and next actions. Preserve conflicts as tradeoffs rather than averaging them.
  Stamp the report "hypothesis, not validation"; persona output is synthetic
  critique, never real-user evidence.

## Plugin bugs and feature requests

For a bug or a feature request about the plugin itself, use `/persona-lab:submit-feedback`. It
drafts the GitHub issue and files it only after the user approves the exact text.
