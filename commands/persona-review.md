---
description: Launch a task-specific persona panel for UI, product, or workflow review.
---

Use the `persona-lab` skill to execute the requested review brief or persona panel below.

Request:

```text
$ARGUMENTS
```

Execution rules:

- Honor an explicit user or workspace/CLI brief first: preserve its artifact,
  version, question, scope, reviewer count, pass budget, and recall restrictions.
  A single-reviewer brief uses multiple lenses as a checklist; it does not launch
  one reviewer per lens. Saved persona references never add reviewers. If the
  brief says no recall, do not search history; if it says no writes, do not save
  personas, encounters, or runs. Do not add retries, debate, or a model judge.
- For an economical executable brief, use `persona brief
  <handoff|interface|decision> --artifact <locator@version> --question "<text>"
  [--constraints "<text>"] [--mode single|panel] [--personas id1,id2] [--json]`.
  It defaults to one reviewer; explicit panel mode uses three independent
  reviewers. The CLI only emits a brief. The host runs the model review.
- When recall is permitted, recall before generating. Use the `persona` CLI to reuse saved work:
  `persona roster list`, `persona list`, `persona search "<query>"`. Scaffold
  the plan with `persona panel "<topic>" [--roster <name> | --auto]
  [--level low|medium|high] [--count N]`. Counts are low 3–4, medium 4–6,
  high 6–8; incompatible explicit counts are rejected, never rounded or clamped.
  `persona panel` and `persona new` prepare plans and skeletons; neither runs
  models. Fill new persona content in the host with `persona new` and
  `persona save` them so they are reusable. Levels: low = 3 to 4 lenses, one
  pass per reviewer; medium = 4 to 6 lenses incl. required red-team, independent passes plus
  synthesis; high = 6 to 8 lenses plus adversarial verification of critical
  findings.
- Unless an explicit brief or user count applies, select perspectives using the
  chosen level (medium defaults to 4 to 6), by task-relevant coverage of goals,
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
- The host verifies every reported defect against the artifact before treating it as real,
  and say plainly where a persona was mistaken. Reported defects are frequently
  silent gates rather than breakage. Low and medium add no separate model judge
  or verification call. High budgets one independent verification pass per
  critical finding; report this additional usage. An explicit brief's smaller
  budget wins. Adjudication and synthesis remain host responsibilities.
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
