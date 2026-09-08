# Changelog

## [0.8.0](https://github.com/tyroneross/ai-persona-lab/compare/persona-lab-v0.7.2...persona-lab-v0.8.0) (2026-09-08)


### Features

* compose source-informed professional personas and task consultations ([58779b3](https://github.com/tyroneross/ai-persona-lab/commit/58779b34b2ccff9cd8adfcfa73730cd396271cce))
* consolidate the web app into persona-lab with shared plugin source ([fc781b1](https://github.com/tyroneross/ai-persona-lab/commit/fc781b1c48add5934a10f2d8472b3445ac0a67ca))
* rename product and plugin to AI Persona Lab ([6856275](https://github.com/tyroneross/ai-persona-lab/commit/6856275a1e54512801d9dccbbac38c51d27a5359))

## 0.7.2

A lint for the rule 0.7.1 could only state.

- `scripts/provenance_lint.py` has two arms. TABLE checks that every row of the
  provenance table has a valid status and an evidence path that resolves on
  disk — deterministic, and safe to make blocking. DIFF flags normative claims
  ADDED by a change set when the provenance table was not touched in the same
  change, so a claim and its standing arrive together.
- Diff-scoped deliberately: re-scanning settled prose every commit produces
  noise nobody reads.
- **Precision was measured before deciding what the gate may do**, at roughly
  40-55% hand-judged over the last 19 commits. Two rounds of tightening moved it
  from ~40% to ~50% and then stalled, so it is WARN-only permanently rather than
  provisionally. The residual false positives are not separable by this approach:
  "A debate lane cannot precede a blind lane" (doctrine) and "`verbatim` is never
  discarded" (a description of implemented behavior) are the same sentence shape,
  and the text does not carry which one it is.
- That precision figure is itself a row in the provenance table, marked
  `measured`, with the sample size stated. The lint is subject to its own rule.
- `scripts/test_provenance_lint.py` pins the table arm and the exemption classes.
  It caught a real gap on its first run — the disclosure phrasing "nothing has
  been calibrated" was being flagged as an unbacked claim, inverting the point.

## 0.7.1

Say plainly what this method has not earned.

The docs are written in a declarative voice so the method stays consistent and
arguable. Read cold — by a new agent that just loaded the plugin and is being
refused by its schemas — that voice reads as validated practice. It is not.

- `docs/LIMITATIONS.md` gives every load-bearing claim its provenance: which
  come from the single six-persona source study, which are measured (the usage
  audit, and only that), and which are asserted design stances with no evidence
  at all (the recall defaults, the `none` default, panel size).
- It records that the live library holds 6 personas, 0 encounters, and 0 runs —
  everything added in 0.4.0-0.7.0 has been exercised only by its own tests.
- It names the ten gaps that would actually change confidence, ordered. The
  first is that nothing has ever been calibrated against how real humans reacted
  to the same artifact, which no control in this repo would catch.
- The pointer is on every entry surface a new agent can arrive through: the top
  of SKILL.md before any instruction, the README, `persona help`, and all three
  agents.
- `persona-research-adjudicator` now states that nothing grades it — it is an
  LLM marking an LLM's homework, and the likeliest place a confident wrong call
  becomes a "verified finding".
- `persona-perspective-reviewer` opens by saying it is a simulated participant,
  not a user.
- New rule for contributors: a claim added to the docs adds its provenance row in
  the same commit. Without that, an assertion becomes indistinguishable from a
  finding within about two commits — which is how the declarative voice happened.

## 0.7.0

Capture which panels earned their cost, and reuse the compositions that did.

- `persona run lesson <run_id> --verdict valuable|mixed|wasted` records what a
  panel produced: what changed, which findings landed, what about the METHOD
  worked or broke, and whether the roster is worth running again.
- `valuable` requires `--changed`. A verdict with nothing named is a compliment,
  not a lesson, and it is the claim most likely to be wrong later. `wasted`
  requires nothing — nothing changing is itself the finding, and it is the most
  useful verdict to hold before composing the next panel.
- `persona run proven` lists rosters that earned another run.
  `persona roster from-run <run_id>` promotes the composition, and refuses a run
  recorded as wasted.
- The outcome renders into `report.md` above the synthesis.

Deliberately NOT added: back-filling historical panels into encounters. Recall
filters on persona, artifact, and project and has no provenance or age check, so
a reconstructed encounter is indistinguishable from a real one at dispatch time
and would anchor a future persona with something nobody observed. It is also the
exact act `persona-research-adjudicator` is instructed to refuse. A past panel
gets a lesson and, if it earned one, a roster — never manufactured memory.

## 0.6.0

Temporary and persistent personas, and a recall scope that decides what a
persona is allowed to bring with it.

Two orthogonal properties on a persona:

- `lifespan` — `persistent` (lives in the library, accumulates history) or
  `temporary` (one run only).
- `recall` — `none` | `artifact` | `project` | `all`. How much of its OWN
  history it may READ when dispatched.

The split exists because some personas' value is cumulative and some is
non-renewable. An architect who forgets prior assessments is a worse architect;
accumulated judgment is the reason to keep it. A first-run user who remembers is
no longer a first-run user, and that loss cannot be undone. You can always give
a persona context; you can never give it back its first look. So `none` is the
default: wrongly-fresh is recoverable, wrongly-anchored is not.

- `recall` defaults per lens in the role catalog, because it is a property of the
  role rather than a dispatcher's mood — novice `none`, UX researcher `artifact`
  (fresh on a new problem, continuous on an ongoing one), buyer/design/PM
  `project`, architect/security/domain/red-team `all`.
- `persona recall <id> [--artifact <slug>] [--project <name>]` prints exactly
  what a persona may bring, plus the `--informed` line to pass into the dispatch.
  Verbatim is reproduced unedited — a summarised memory is one the persona
  rationalises from rather than recalls.
- The gate is enforced at both seams (`encounter new --informed` and
  `encounter save`): a `recall: none` persona cannot be shown prior encounters,
  and no persona can be shown one outside its scope.
- The two refusals are diagnosed separately. Another persona's transcript is not
  a narrow scope — it is a debate round, and belongs in a debate lane.
- `artifact.project` added to the encounter and run schemas so `project` scope
  has a grouping above the artifact slug.
- A temporary persona cannot have `project` or `all` recall — it has no history
  outside its run.
- Writing is never gated; only reading. A `none` persona still records
  everything, because the analyst needs the transcript the persona may not read.

## 0.5.0

A persona run becomes a durable object. `personas.json` held who a persona is
and `encounters/` held what one persona saw in one sitting, but the panel itself
— the roster, the frozen artifact, the lanes in order, what nobody could settle
— was never a thing you could open afterwards.

```
~/.persona-lab/runs/<run_id>/run.json    the machine record
~/.persona-lab/runs/<run_id>/report.md   the readable one, generated
~/.persona-lab/runs/<run_id>/notes/      anything a human or agent adds
```

- `persona run new|list|show|report|close`, backed by `lib/runs.mjs` and
  `schemas/run.schema.json`.
- History reads both directions. Encounters stay indexed by persona, because a
  persona's history ACROSS panels is what makes it worth keeping; the run
  references them by id and each encounter carries `run_id` back. So "everyone
  on this panel" and "every panel this persona sat on" are both one command.
- The freeze rule is now enforced where the run is recorded, not only in prose:
  `run new` refuses to open without `--version`, and the schema pins
  `artifact.frozen` to true.
- Lane order is validated. A debate lane cannot precede a blind lane — running
  debate first destroys the only unanchored reaction the panel will ever get,
  and it cannot be recovered.
- `run close` pools every encounter's `unanswered` into the run. That list is
  the next dispatch's agenda.
- `report.md` separates verified findings from positions. A preference is not a
  defect awaiting verification; it is a position that needs a decision. Filing
  the two together is the conflation the method exists to prevent.
- A closed run refuses new encounters, and the refusal holds: the encounter is
  still saved (a persona's verbatim is not discardable) but its pointer is
  demoted to `unlinked_run_id`, so the backlink cannot pull it into a report for
  a panel that had already closed.

## 0.4.1

Close the activation gap. `scripts/persona_usage_audit.py` over 1821 transcripts
found the skill had never been invoked and the agents never dispatched — the
plugin ships in the RossLabs-AI-Toolkit marketplace but was never enabled. The
26 sessions that used personas anyway did it by hand, so the demand was never in
question; the reachability was.

- Skill `description` rewritten against the 11 verbatim requests that should
  have fired it. Leads with "launch" (the dominant verb, 4 of 11), adds the
  observed vocabulary — dispatch, debate, interview, stress-test, in parallel,
  raw reactions separate from synthesis — and carries an explicit anti-trigger
  so it does not fire on personalization features or a solo UI review.
- Added skill §5b Debate Rounds. Users ask for personas that argue; the skill
  forbade cross-visibility. Both hold if they stay ordered: blind independent
  passes always run first and are saved, then an optional debate pass runs with
  `blind: false` and `prior_encounters_shown` naming the other personas'
  positions — never the persona's own history, which produces rationalisation
  rather than argument.
- `persona validate` now validates a persona as it will exist after save, so a
  fresh `persona new` scaffold reports only the 7 fields a human must fill
  instead of 12 errors including `id`/`created_at`/`updated_at` that saving
  mints anyway. `--strict` keeps the raw pre-save view.
- Scenarios must now carry a non-blank title and description. The scaffold
  shipped `[{title:"",description:""}]` and the validator only counted array
  length, so every persona created on the happy path saved with a required
  field that said nothing. All 6 personas in the existing library still
  validate unchanged.

## 0.4.0

Persona memory becomes executable. The encounter schema and `docs/persona-memory.md`
landed in 0.3.x as documents; nothing an agent runs actually read them. This wires
them into the CLI, the agents, the skill, and the commands.

- Added `persona encounter new|save|validate|list|show`, backed by
  `lib/encounters.mjs`. Encounters live in the global library at
  `~/.persona-lab/encounters/<persona_id>/`, beside `personas.json`, so a persona
  recalled from any repo carries its history. Append-only: a recorded
  `encounter_id` is never overwritten.
- The validator enforces the five fields the method depends on: `verbatim` is
  required (and never summarised), `conditions.viewports` must be non-empty,
  `blind` must be declared, an informed read must name its
  `prior_encounters_shown` (and a blind read must not), and a `reclassified`
  finding must carry a `verification_note`.
- Added `agents/persona-research-adjudicator.md`. The UX-researcher layer earned
  its place in the source study as an *adjudicator*, not a summariser: it verifies
  every reported defect against the artifact, marks findings confirmed / refuted /
  reclassified / unverified, and says plainly where a participant was mistaken. It
  refuses to reconstruct a missing participant from that participant's own prior
  reports.
- `persona-perspective-reviewer` now writes its encounter *before returning* and
  gets one turn: it becomes unreachable about thirty seconds after it finishes, so
  anything it cannot settle goes into `unanswered` rather than a follow-up.
- `persona-panel-orchestrator`, the skill, `/persona-lab:persona-review`, and
  `/persona-lab:run` now freeze and version the artifact before any persona sees
  it, ask everything in the first dispatch, run blind by default, and adjudicate
  before synthesis.
- The skill states the method's bound explicitly: simulated participants giving
  reactions, with no task-success or timing data.

## 0.3.0

- Added `/persona-lab:run`: autonomously drive an AI User Personas council run to
  completion — one independent subagent per persona pass, record findings,
  synthesize preserving conflicts. Hard budget gate at 20 total passes.
- Skill documents the headless council API (rosters/runs/findings/synthesis/status)
  and the autonomous-run protocol.

## 0.2.0

- Added the `persona` CLI (`bin/persona.mjs`): new/save/validate/list/show/
  search/rm/archive, roster save/list/show/rm/lenses, and panel planning.
- Added a global, recallable persona library at `~/.persona-lab/` (override
  with `PERSONA_LAB_HOME`), shared by the CLI, coding agents, and the app.
- Added `lib/library.mjs` (library + validation) and `lib/roles.mjs` (lens
  catalog with a guaranteed adversarial/red-team lens per panel).
- Schema v1.1.0: added `job_to_be_done`, `anti_goals`, and `provenance`.
- Folded research-backed guardrails into the skill and agents: hypothesis-not-
  validation stamp, mandatory red-team lens, engineered independence,
  abstain-over-fabricate, conflict-preserving synthesis, per-finding provenance.
- Wired the Next.js app repository to the shared library; `persona-plan.mjs`
  retained as the legacy planner.

## 0.1.0

- Initial dual-host Claude Code and Codex plugin.
- Added shared persona panel skill, slash command, orchestrator agent,
  perspective reviewer agent, role-selection reference, and deterministic
  roster planning script.
