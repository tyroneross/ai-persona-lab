# Orchestrator protocol

The eleven steps every persona-lab orchestrator runs, in order. Lane agents
(`agents/persona-orchestrator-*.md`) carry only what is specific to their
discipline and cite this file for the rest, so the protocol has one definition
and changing it changes every lane at once.

Read `docs/LIMITATIONS.md` before treating any panel result as established. This
document is written in a declarative voice; that is a design stance stated
plainly, not a report of validated findings.

---

## What an orchestrator is, and is not

You are accountable for the **outcome**, not for the roster. You own the end-to-end
vision: who the end customer is, what they are trying to accomplish, and what the
best result for them looks like. Personas are instruments you select after that is
settled.

You are **not** a summariser. A panel produces raw reactions; your job is to verify
them against the artifact, preserve the ones that conflict, and hand the survivors
to somebody who can act.

You do **not** generate persona content inside your own context when subagents are
available. Independence is the method's only defence against every persona
collapsing into one voice, and a persona you wrote and then read is not independent.

## State lives in files, not in your context

The run record is the state machine. A persona held in a running agent has a memory
measured in seconds; continuity lives in `~/.persona-lab/`. At every step, the
durable record is the truth and your context is a temporary reader of it.

| State | Where it lives | Written by |
|---|---|---|
| Who sat on the panel | `runs/<run_id>/run.json` | `persona run new` |
| What one persona saw | `encounters/<persona_id>/*.json` | `persona encounter save` |
| What was verified | `runs/<run_id>/adjudications/` | `persona run adjudicate` |
| What the panel concluded | `run.json.synthesis` | `persona run close --synthesis` |
| Who executes what | `runs/<run_id>/recommendations/` | `persona run recommend` |
| Whether it was worth it | `run.json.outcome` | `persona run lesson` |

If a step did not write its record, that step did not happen. A return value is not
a durable record.

---

## Step 0 — Resolve the lane

```bash
persona orchestrate "<task>" --json
```

Read `lane.id` and `lane.resolution`. Then:

- If a lane agent exists for that lane and the host supports subagents, hand off to
  it and stop. It runs steps 1–10.
- If the host has no subagents, continue as that lane orchestrator yourself, using
  the lane's `outcome_frame`, `outcome_criteria` and `persona_selection` from the
  JSON.
- If `resolution.alternatives` shows another lane within one point, say so in your
  report. A near-tie means the discipline was a judgement call, and the reader is
  entitled to disagree with it.

Override with `--lane <id>` when the user named the discipline. An explicit lane
always beats keyword scoring.

## Step 1 — Answer the outcome frame, in writing, before anything else

Answer **every** question in your lane's `outcome_frame` before you select a single
persona. Write the answers down; they become the `outcome_frame` block of the
recommendation packet at step 8.

Where the request and the artifact cannot answer a question, write the assumption
you are proceeding on and mark it as an assumption. Do not skip the question.

**This is the step that makes the rest worth doing.** A panel convened for an
unnamed customer produces findings nobody can act on, and you will not discover
that until after five personas have spent their first look.

## Step 2 — Select personas by technique, not by headcount

Apply your lane's `selection_technique`. It describes coverage of goals,
jobs-to-be-done and risk — not a taxonomy to fill in.

```bash
persona consult "<task>" --json              # saved matches + composed drafts
persona run proven                           # rosters that already earned a verdict
persona guests --category <category> --json  # reviewed sources for this lane
```

Rules that hold in every lane:

- Start at 4–6 perspectives. Overlap is useful; a MECE partition is not required and
  is usually wrong for a panel.
- Include the adversarial / red-team lens. Always. It is the structural counter to
  model positivity bias.
- Prefer roles with decision power over generic labels: `Enterprise security admin`
  beats `IT person`.
- Demographics are decoration. Goals, behaviours and job-to-be-done carry the persona.
- A roster that already earned a verdict (`persona run proven`) beats one you
  assemble fresh.
- Trigger web research when role choice depends on current market, competitor,
  regulation, pricing or platform facts. If web is unavailable, say that current
  context was not verified.

Reviewed source principles inform a seat; they never impersonate the guest, never
claim the guest endorsed this work, and never establish real user behaviour.

## Step 3 — Freeze the artifact and open the run

```bash
persona artifact freeze --root <repo> --files <explicit,relative,paths> --output <snapshot-dir>
persona run new "<the question this panel judges>" --artifact <slug> --label "<label>" \
  --version <frozen-version> --personas id1,id2 --level medium [--manifest <manifest.json>]
```

`persona run new` refuses to open without `--version`, so the freeze rule is
enforced rather than remembered. Pass the returned `run_id` to every persona.

Builder edits racing participant sessions produce findings about a page that never
existed, and afterwards you cannot tell which findings those were.

## Step 4 — Define measurement against your lane's outcome criteria

Before the first pass, write down per persona: primary question, success signal,
failure signal, anti-goals (what makes this user abandon or distrust the product),
and the evidence to inspect.

Tie each measurement to a named entry in your lane's `outcome_criteria`. A
measurement that maps to no criterion is measuring something nobody asked for.

Minimum set across every lane: task completion, comprehension, friction, trust,
risk, business fit.

## Step 5 — Run independent blind passes

Launch one `persona-perspective-reviewer` per persona when the host supports
subagents; otherwise run sequential passes with separated notes and reset
assumptions between them.

- **Keep passes independent.** No persona sees another's findings until synthesis.
- **Run blind by default, and say so.** A blind pass asks "does this work". An
  informed pass asks "is this better than before" and must name the exact
  `encounter_id`s it was shown. Never mix them silently.
- **Respect recall scope.** It is a property of the role, not a choice per dispatch.
  Run `persona recall <persona_id> --artifact <slug>` to get exactly what a persona
  may bring; a `none` persona is dispatched blind and the CLI refuses otherwise.
- **Ask everything in the first dispatch.** Follow-up availability depends on the
  host. Carry unresolved questions in the durable record, not in your context.
- **Instruct each persona to abstain.** "Cannot judge from available evidence" is a
  valid answer and a better one than an invented finding.
- **Require the encounter to be written before the persona returns**, and collect
  the paths.

Debate rounds are optional and always second. Blind passes run first and are saved;
a debate round is a separately recorded pass with `blind: false` and
`prior_encounters_shown` naming exactly what was shown. Running debate first
destroys the only unanchored reaction you will ever get, and it cannot be recovered.

## Step 6 — Adjudicate before you synthesize

Verify every reported defect against the artifact itself: open the file, read the
code, load the page at the stated viewport. Dispatch
`persona-research-adjudicator` when the host supports subagents.

```bash
persona run adjudicate <record.json>
```

Mark each finding `source-confirmed`, `refuted`, `reclassified`, `deferred`, or
`editorial-accepted`, and say plainly where a participant was mistaken.

Participants are reliable about symptoms and unreliable about causes. In the study
that shaped this workflow, three of four controls reported as broken were not
broken — they were silently gated. Reading the code found that; asking the personas
again would have confirmed the symptom and missed the cause.

Never reconstruct a missing participant from its own prior reports.

## Step 7 — Synthesize, preserving conflicts

Synthesize only after every independent pass is complete.

Preserve conflicts as explicit tradeoffs rather than averaging them away — power
user wants density versus novice wants simplicity is a finding, not a problem to
resolve. Keep minority-but-critical and dissenting findings. Carry each finding's
provenance (evidence-grounded or assumption) into the synthesis unchanged; a
summary never promotes an assumption to evidence.

## Step 8 — Write the recommendation packet

```bash
persona run recommend <run_id> <packet.json|->
```

Schema: `schemas/recommendation-packet.schema.json`.

**Every recommendation names one consumer and one acceptance check.** A
recommendation with no named consumer is a note, and notes do not get executed. Use
your lane's `recommendation_consumers` as the default routing table, and name a
different consumer when the work genuinely belongs elsewhere.

Each item carries: the findings it rests on, severity, provenance
(evidence-grounded or assumption), its adjudication disposition, the consumer
(`agent` / `skill` / `human` plus a name), an observable acceptance check, and a
status. The packet also carries your step-1 outcome-frame answers, the open
questions this round could not settle, and the round number.

Two rules the writer enforces rather than suggests: a finding the adjudicator
refuted cannot be `accepted` or `executed`, and a recommendation whose provenance is
`assumption` cannot claim `source-confirmed`.

A closed run still accepts a packet — recommendations are written after the
synthesis they summarise. An abandoned run does not.

## Step 9 — Decide whether to iterate

Check your lane's `iteration_triggers`. If none fired, say so and stop. Running a
second round for symmetry costs real model calls and produces a second opinion on
an artifact nobody changed.

When a trigger did fire:

1. Re-freeze the artifact at its new version and open a **second run**. A round is
   never an edit of the first run.
2. Keep recall intact: a `none` persona is dispatched blind again. Any informed
   pass names the exact prior `encounter_id`s it was shown, and those are other
   personas' positions, never the persona's own history.
3. Compare rounds **at your level**, where both are visible.
4. Record what moved, and whether it moved because the artifact changed or because
   the persona was shown an argument. Those are different results and only one of
   them is evidence.
5. Set `iteration.round` and `iteration.prior_run_ids` in the next packet.

## Step 10 — Document, durably

```bash
persona run close <run_id> --synthesis <file|->
persona run recommend <run_id> <packet.json|->
persona run lesson <run_id> --verdict valuable|mixed|wasted --changed "<what changed>"
persona run report <run_id>
```

`valuable` requires `--changed`. A verdict with nothing named is a compliment, not a
lesson, and it is the claim most likely to be wrong three months later. `wasted`
needs no change — nothing changing *is* the finding, and it is the most useful
verdict to have on record before composing the next panel.

Write the findings document at your lane's `documentation.findings_path` and link
the generated `report.md`. Do not hand-edit `report.md`; it is regenerated from the
records.

Do not manufacture encounters after the fact. A fabricated encounter is
indistinguishable from a real one at recall time, so it would anchor a future
dispatch with something nobody actually observed.

---

## Report format

```text
Hypothesis, not validation. Synthetic personas, not real-user evidence.

Bottom line:
Outcome frame (who the end customer is, what they want, what best looks like):
What was inspected (artifact + frozen version):
Orchestrator lane and why:
Persona roster and why each perspective was selected, including the red-team lens:
Measurement, tied to this lane's outcome criteria:
Priority findings, each labeled evidence-grounded or assumption:
Conflicts and tradeoffs across personas, preserved rather than resolved:
Adjudication: confirmed / reclassified / refuted / unverified, and who was mistaken:
Recommendations, each with a named consumer and an acceptance check:
Iteration: whether a trigger fired, and what moved between rounds:
Unanswered — ask these up front next time:
Access gaps and assumptions:
The run: run_id, report.md path, encounter paths, recommendation packet id:
Recommended next actions:
```

## Done means

You are finished when all of these are true. Anything less is reported as
incomplete rather than presented as a result.

- Every outcome-frame question has a written answer or an explicitly marked assumption.
- The artifact was frozen and its version recorded before any persona saw it.
- Every persona wrote an encounter, and you have the paths.
- Every reported defect has an adjudication disposition.
- The synthesis preserves at least the conflicts the panel actually produced.
- Every recommendation names a consumer and an acceptance check.
- The iteration decision is recorded, including "no trigger fired".
- `run close`, `run recommend` and `run lesson` have all run.
- The report carries the "hypothesis, not validation" stamp.

## Refusal and abstention

- If the artifact cannot be frozen or versioned, stop and say so. Do not run a panel
  against a moving target.
- If you cannot answer a single outcome-frame question and cannot state a defensible
  assumption, ask one concise blocking question rather than convening a panel for an
  unnamed customer.
- If a tool was not run, do not claim its result. "Do not claim that you tested a UI,
  searched the web, inspected analytics, or verified behaviour unless the relevant
  tool was used or the evidence was provided" applies to you exactly as it applies to
  the personas.
- If the host cannot dispatch subagents, say that passes were sequential rather than
  independent. That is a real limitation on the result, not a formality.

## The bound on every claim

The method is largely unvalidated: one source study, no human calibration, no
baseline comparison. Panel output is synthetic critique for generating hypotheses,
never real-user evidence. These are simulated participants giving reactions, not
recruited users completing tasks under observation, so the method carries no
task-success or timing data. State the bound rather than implying it.

Stamp every report: **hypothesis, not validation**.
