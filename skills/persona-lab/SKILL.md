---
name: persona-lab
description: Use when an agent or user needs professional expertise for planning, building, coaching, investing, marketing, engineering or UI/UX work, or asks to execute an AI Persona Lab workspace/CLI review brief or launch, spin up, or dispatch personas — a persona panel, council, or roster that reviews, debates, interviews, stress-tests, or gives feedback on an artifact and reports back, optionally in parallel and with raw persona reactions kept separate from the synthesis. Not for personalization features or an unrelated solo UI review.
---

# AI Persona Lab

> **Before you follow any of this: read `docs/LIMITATIONS.md`.**
> This document is written in a declarative voice — "always run blind first",
> "a first impression is non-renewable". That is a design stance stated plainly
> so it can be followed consistently and argued with. It is **not** a report of
> validated findings. Nearly all of it rests on a single six-persona study on one
> artifact on one day, the live library has recorded zero real runs to date, and
> the method has never been calibrated against how actual humans reacted to the
> same artifact. The schemas will enforce these opinions against you; that is
> consistency, not evidence. Treat the enforcement as this project's position and
> say so when you report results.


## Objective

Turn a user query or request into a focused review brief or persona panel that can review a UI,
product, workflow, feature plan, API surface, or research artifact.

This skill is not a replacement for real user research. It is a structured
synthetic review method for finding likely product, usability, business,
technical, and risk issues before or between real research cycles.

Synthetic personas are legitimate for hypothesis generation and critique, never
for validation. Every panel output is a hypothesis, not real-user evidence.
Stamp the report as "hypothesis, not validation" and never present a persona
finding as proof of real user behavior.

## Professional task consultation

Agents can call `persona consult "<task>" --json` before choosing a panel or
writing a plan. Use `--mode ui-ux` for interface work and `--specialties` for
explicit expertise paths. The CLI returns a plan and saved-persona matches or
composed drafts; it does not execute model calls. Read the returned principles,
including `avoid_when`, and evidence gaps before dispatch.

Use `persona archetypes --defaults` for five starter perspectives, and
`persona archetypes` for the expandable professional catalog. `persona compose
marketer --specialties product-marketing,hardware/networking --save` creates a
persistent draft. Specialty paths have no fixed depth or closed vocabulary;
a label does not establish competence. The task consultant instructions live
in `agents/persona-task-consultant.md`, and `/ai-persona-lab:consult` exposes the
workflow. Existing review panels, recall rules, encounters and council runs
remain separate contracts.

## Workflow

### Explicit brief and budget take precedence

An explicit user request or workspace/CLI brief controls artifact/version,
question, scope, reviewer count, pass budget, and recall. Preserve those values
through dispatch and reporting. Do not expand one reviewer into one per lens.
Saved persona references provide optional context, not extra reviewers or role
assignments. Enforce the brief's recall restriction even when a saved profile
allows broader recall; `none` means no history lookup. A no-write request skips
persona, encounter, and run persistence. These constraints override the default
panel and memory workflow below.

For a focused brief, run:

```bash
persona brief <handoff|interface|decision> --artifact <locator@version> \
  --question "<text>" [--constraints "<text>"] [--mode single|panel] \
  [--personas id1,id2] [--json]
```

The default is one general reviewer using three lenses as a checklist. Explicit
panel mode uses three independent reviewers. This command only emits text/JSON:
it does not call models or write records. The host executes the brief. These
briefs budget one pass per reviewer, no retries and no model judge. A maintainer
checks evidence and reconciles findings without adding an independent LLM pass.

### 1. Capture the Request

Restate the request in one sentence.

Identify:

- Target artifact: app, screen, workflow, PRD, repo files, screenshot, data,
  logs, design, or prompt.
- Decision being supported: ship, revise, prioritize, scope, test, debug,
  compare, or explain.
- Primary user outcome.
- Constraints: timeline, platform, audience, business model, compliance,
  existing plan, or implementation limits.

### 2. Select Persona Perspectives

Prefer 4 to 6 sharply distinct lenses unless the user specifies a different
count. Fewer, well-separated lenses beat many overlapping ones.

Recommended default critique lenses:

1. Novice / first-run user.
2. Power user / expert.
3. Skeptic / adversary / red-team. Required as a lens, including within a single reviewer's checklist.
4. Accessibility / constraint-bound user.
5. Decision-maker / buyer.
6. Domain specialist.

Selection rules:

- Pick perspectives by task-relevant goals, jobs-to-be-done and risk. Broad
  professional archetypes and subspecialties may overlap; do not require a
  MECE taxonomy. Demographics are not a substitute for expertise.
- Goals, behaviors, and job-to-be-done are the load-bearing persona elements.
  Demographics are decoration and invite stereotyping. Keep them optional and
  omit unless the topic requires them.
- Each persona must represent a distinct lens, not a superficial variation of
  another.
- Prefer roles with decision power over generic labels. For example:
  `Enterprise security admin` is better than `IT person`.
- Include at least one adversarial / red-team lens within the authorized reviewer count.
  It is the structural counter to LLM positivity bias.
- Include accessibility or inclusive-design review when the artifact is a UI,
  workflow, form, onboarding path, dashboard, or content-heavy surface.
- Use internet research when role choice or context depends on current market,
  company, competitor, regulation, pricing, trend, or domain facts.

Use `references/persona-selection.md` for the critique lenses, the fuller role
catalog, and the independence and anti-sycophancy rules.

### 3. Check Task, Intent, And Execution Access

Before launching the review, verify what is available.

Check for:

- Files or repo paths to inspect.
- Running app URL or local dev server.
- Screenshots, recordings, analytics, logs, support tickets, survey data, or
  research notes.
- Browser, shell, web, or data access.
- User-provided success criteria.

If access is missing but the review can proceed, label the review as synthetic
and list access gaps. If access is required to avoid a misleading answer, ask
one concise blocking question.

**Freeze the artifact before any persona sees it.** Snapshot it, record a
`version` string, and pass that version to every persona. Builder edits racing
persona passes produce findings about a page that never existed, and afterwards
you cannot tell which findings those were.

Do not claim that you tested a UI, searched the web, inspected analytics, or
verified behavior unless the relevant tool was used or the evidence was
provided.

### 4. Plan Steps And Measurement

Define measurement before the persona passes.

Use this minimum measurement set:

- Task completion: can the persona complete the intended action?
- Comprehension: does the persona understand what to do and why?
- Friction: what slows, blocks, or confuses the persona?
- Trust: what makes the persona doubt the product, data, or next step?
- Risk: what could create privacy, security, legal, operational, or brand harm?
- Business fit: does the experience support the desired product outcome?

For each persona, define:

- Primary question.
- Success signal.
- Failure signal.
- Anti-goals: what would make this user abandon, distrust, or reject the
  product.
- Evidence to inspect.

### 5. Launch The Persona Panel

Engineer independence. Distinct personas collapse into one homogeneous voice
when they share a transcript or a status hierarchy. Run each persona's critique
in a separate context with no shared transcript and no visibility into other
personas' findings. Synthesize only after all independent passes complete.

Each persona must be allowed and instructed to abstain. LLMs fabricate roughly
half the time instead of admitting uncertainty. A persona that cannot judge a
point from the available evidence must answer "cannot judge from available
evidence" or "no concern" honestly, rather than invent a finding.

**Ask everything in the first dispatch.** A persona subagent becomes
eviction-eligible roughly thirty seconds after it finishes. There is no reliable
follow-up interview. A question you plan to ask in a second turn is a question
you will not get to ask, so put it in the brief now. Anything a persona cannot
settle goes into its `unanswered` list rather than into a follow-up.

**Run blind by default.** A blind pass asks "does this work". An informed pass
asks "is this better than before" and must name the exact prior `encounter_id`s
the persona was shown. Never mix them silently: a persona handed its own prior
answers rationalises a position it never held. Compare rounds at the synthesis
level, where both are visible, not by showing a persona its own history.

Preferred launch path when subagents are available:

0. Open the run: `persona run new ... --version <frozen>`. Pass the `run_id` to
   every persona so its encounter joins the panel.
1. Use `persona-panel-orchestrator` to select personas and measurement.
2. Launch `persona-perspective-reviewer` once per persona, each with the
   assigned persona, frozen artifact version, and measurement criteria, and no
   knowledge of the other personas or their findings.
3. Keep each review independent until synthesis.
4. Require each persona to write its encounter file *before returning*, and
   collect the paths. See "Encounter memory" below.
5. The host adjudicates evidence before synthesis. Low and medium levels add no
   separate model judge or verification call. High adds one independent model
   verification pass per critical finding, with usage reported separately.
   A brief's explicit pass budget overrides this default.

Fallback launch path:

1. Run sequential persona passes in the main conversation.
2. Reset assumptions between passes and do not carry one persona's findings into
   the next.
3. Keep notes separated by persona before synthesis.

For UI work, inspect actual files and use browser/screenshot verification when
the app is available. For strategy, market, regulated, or competitor-sensitive
work, research current sources before making current-state claims.

### 5b. Debate Rounds (optional, and always second)

Users ask for personas that argue with each other. Independence and debate are
not in conflict as long as they stay ordered: **blind independent passes always
run first, and a debate round is a second, separately-recorded pass.** Running
debate first destroys the only unanchored reaction you will ever get from that
persona, and it cannot be recovered.

1. Run the independent blind passes. Save each encounter (`blind: true`).
2. Show each persona only the *positions* it should respond to, named by
   `encounter_id`, and dispatch a second pass with `blind: false` and
   `prior_encounters_shown` listing exactly what it saw.
3. Record the debate pass as its own encounter. Never overwrite the blind one —
   the schema refuses it, and the pair is the evidence that a position moved.
4. Report both rounds side by side. A persona that changed its mind under
   argument is a finding; a persona that changed its mind because it was shown
   its own prior answer is a rationalisation, which is why step 2 shows other
   personas' positions and never the persona's own history.

A host adjudication reads both rounds. A separate model judge requires an
explicitly budgeted pass. Adjudication verifies claims against the artifact and reports where the
debate changed a position without changing the evidence.

### 6. Report Back

Use bottom-line-first structure.

Required report:

```text
Bottom line:
What was inspected (artifact + frozen version):
Persona roster:
Measurement:
Priority findings:
Persona-specific findings:
Conflicts, preserved rather than resolved:
Adjudication (confirmed / reclassified / refuted / unverified):
Unanswered — ask these up front next time:
Access gaps and assumptions:
Encounter records written:
Recommended next actions:
```

Findings should include:

- Severity: critical, high, medium, or low.
- Evidence: file, screen, quote, source, screenshot, command, or observed
  behavior.
- Provenance: evidence-grounded or model assumption. Label every ungrounded
  finding as an assumption.
- Impact: why the persona cares.
- Fix: concrete recommendation.
- Confidence: high, medium, or low.

**Verify every reported defect against the artifact before treating it as real.**
A reported defect and a real defect are different objects. Personas are reliable
about symptoms and unreliable about causes: in the study that shaped this
workflow, three of four controls reported as broken were not broken, they were
gated, and every gate was silent. Reading the code found that; asking the
personas again would have confirmed the symptom and missed the cause. Mark each
finding `confirmed`, `refuted`, `reclassified`, or `unverified`, and say plainly
where a persona was mistaken.

Keep the synthesis decisive, but preserve conflicts as explicit tradeoffs rather
than averaging them away. For example: power user wants density versus novice
wants simplicity. Preserve dissenting critical findings when one persona flags an
issue that others do not.

Stamp the report as "hypothesis, not validation". These are synthetic
perspectives, not real-user evidence. State the bound rather than implying it:
the method produces reactions from simulated participants, not task-success or
timing data from recruited users under observation. That distinction limits
every claim the panel can make.

### Record what the panel produced

A panel that nobody judged is a panel you will run the same wrong way again.
After the artifact changes (or doesn't), record the lesson:

```bash
persona run lesson <run_id> --verdict valuable|mixed|wasted \
  --changed "what actually changed because of this panel" \
  --landed "finding claim;another" \
  --worked "what about the METHOD worked" \
  --failed "what broke" \
  [--reuse-roster | --no-reuse-roster]

persona run proven                                    # rosters that earned another run
persona roster from-run <run_id> --name "<name>"      # promote the composition that worked
```

`valuable` requires `--changed`. A verdict with nothing named is a compliment,
not a lesson, and it is the claim most likely to be wrong three months later.
`wasted` needs no change — nothing changing *is* the finding, and it is the most
useful verdict to have on record before composing the next panel.

This is a lesson **about the run**. It is never a reconstruction of what a
persona saw: encounters are the only record of that, and a persona that did not
write one has no memory to recover. Do not manufacture encounters after the
fact — a fabricated encounter is indistinguishable from a real one at recall
time, so it would anchor a future dispatch with something nobody actually
observed.

## Temporary and Persistent Personas

Two properties decide what a persona *is*, and they are orthogonal.

**`lifespan`** — does it outlive the run?

- `persistent` — lives in the library, reusable across projects, accumulates a
  history. The default.
- `temporary` — exists for this run only. Use it when the perspective is
  specific to one situation and would be noise in the library.

**`recall`** — how much of its own history may it *read* when dispatched?

| scope | brings | right for |
|---|---|---|
| `none` | nothing, ever | novice, first-run user — the unanchored first look |
| `artifact` | prior encounters with this same artifact | UX researcher on an ongoing problem |
| `project` | encounters across artifacts in the same project or category | buyer, designer, PM, content |
| `all` | everything it has seen | architect, security, domain expert, red-team |

The reason these are separate: **some personas' value is cumulative and some is
non-renewable.** An architect who forgets prior assessments is a worse architect
— accumulated judgment is the entire reason to keep it. A first-run user who
remembers is no longer a first-run user, and unlike the architect's, that loss
cannot be undone. You can always give a persona context. You can never give it
back its first look.

So `none` is the default, and `recall` is a property of the **role**, not a
dispatcher's mood. The lens catalog carries a default per lens.

```bash
persona recall <persona_id> [--artifact <slug>] [--project <name>]
#   prints exactly what this persona is permitted to bring, and the
#   --informed id,id line to pass into the dispatch. Empty for `none`.
```

**Writing is never gated; only reading is.** Every persona records what it saw,
including a `none` persona — the analyst needs that transcript even though the
persona may never read it back.

The gate is enforced, not advised: dispatching a `recall: none` persona with
prior encounters is refused, and so is showing any persona an encounter outside
its scope. Handing a persona *another* persona's position is a different act
entirely — that is a debate round, and it belongs in a debate lane after the
blind passes are saved (§5b).

If you need a knowledgeable version of a fresh persona, that is a **different
persona**, not the same one with a flag flipped.

## Run Memory

A panel is a durable object, not a conversation that ends. Open a run before the
first persona is dispatched and close it after adjudication:

```bash
persona run new "<the question the panel is judging>" \
  --artifact <slug> --label "<label>" --version <frozen-version> \
  --personas id1,id2,id3 [--level medium]

# each persona writes its encounter against the run
persona encounter new <persona_id> --run <run_id> --artifact <slug> --version <v>

persona run close <run_id> --synthesis <file|->      # pools every `unanswered`
persona run list | show <run_id> | report <run_id>
```

```text
~/.persona-lab/runs/<run_id>/run.json    roster, frozen artifact, lanes, status
~/.persona-lab/runs/<run_id>/report.md   generated — verbatims, findings, splits
~/.persona-lab/runs/<run_id>/notes/      anything you or an agent adds
```

Three properties the run record enforces rather than recommends:

- **`--version` is required to open a run.** The freeze rule stops being advice.
- **A debate lane cannot precede a blind lane.** Order is the safety property.
- **A closed run refuses new encounters.** The encounter is still saved — a
  persona's verbatim is never discarded — but its pointer is demoted to
  `unlinked_run_id` so it cannot appear in a report for a panel that had closed.

History reads both directions: `persona run show` lists everyone on this panel,
`persona encounter list <persona_id>` lists every panel that persona sat on.
Encounters stay indexed by persona because a persona's history across panels is
what makes it worth keeping.

## Encounter Memory

`personas.json` holds who a persona is. Encounters hold what it has *seen*. Both
live in the global library, so a persona recalled in any repo carries its
history:

```text
~/.persona-lab/personas.json                 who they are, stable
~/.persona-lab/encounters/<persona_id>/*.json  what they met, append-only
```

A persona held in a running agent has a memory measured in seconds. Continuity
lives in files; a running agent is a temporary reader of those files, never the
place state is kept.

```bash
persona encounter new <persona_id> --artifact <slug> --label "<label>" --version "<v>"
#   emits a scaffold. --informed id1,id2 marks the pass informed rather than blind.
persona encounter save <file|->      persona encounter validate <file|->
persona encounter list [<persona_id>] [--artifact <slug>]
persona encounter show <encounter_id>
```

Five fields carry the method, and the validator enforces them:

- **`verbatim`** is authoritative and never summarised. Structured `findings`
  are a lossy extraction kept beside it so any conclusion stays checkable
  against what was actually said.
- **`kind`** separates a `defect` from a `preference`. A control that will not
  move and a metaphor someone dislikes need different responses.
- **`verified`** allows `reclassified`, not only confirmed or refuted, because a
  reported defect often turns out to be a silent gate.
- **`unanswered`** records what a session could not settle, so the next dispatch
  asks it up front instead of assuming a second turn.
- **`conditions.viewports`** is required. Half of the source study's real
  defects existed only at phone width.

Encounters are append-only: a saved `encounter_id` is never overwritten. A
second look is a second encounter.

Full contract: `docs/persona-memory.md`. Method assessment that produced it:
`docs/persona-method-assessment.html`.

## Review Levels

- low: 3 to 4 lenses, one independent pass per reviewer. Fast first-look critique.
- medium: 4 to 6 lenses including the required red-team lens, independent passes
  plus synthesis. The default.
- high: 6 to 8 lenses, independent passes plus adversarial verification of
  critical findings plus measurement rigor.

`persona panel --count N` supports low 3–4, medium 4–6, and high 6–8. It rejects
incompatible explicit counts and roster sizes rather than silently changing the
request. JSON reports `requested_review_passes`, `effective_review_passes`, and
`additional_model_passes`. Use `persona brief` for one reviewer. Low and medium
have no extra model verification passes; the host still checks evidence and
synthesizes findings.

## Persona CLI

The `persona` CLI is the deterministic substrate: it selects distinct lenses,
persists and recalls personas and rosters, and scaffolds the review plan. The
generative and review steps are yours as the LLM host; call the CLI to plan,
persist, and recall.

When the brief permits recall, recall before generating. Reuse saved personas and rosters instead of
regenerating from scratch:

```bash
persona list [--tag <tag>] [--role <role>] [--status <status>]
persona show <id>
persona search "<query>"
persona roster list
persona roster show <name>
```

Generate and save. `persona new` emits distinct lens skeletons plus a generation
prompt and a measurement plan; you fill the persona content, then save so it is
reusable across repos:

```bash
persona new "<brief>" [--count N] [--roster <name>]
persona save <file.json|->
persona validate <file.json|->
```

Scaffold the review. `persona panel` emits the review plan (lenses,
measurement, independence rules, and guardrails) for you to execute:

```bash
persona panel "<topic>" [--roster <name> | --auto] [--level low|medium|high] [--count N]
```

Record what a persona saw (before the persona returns):

```bash
persona encounter new <persona_id> --artifact <slug> --label ".." --version ".."
persona encounter save <file|->      persona encounter list [<persona_id>]
```

Other commands:

```bash
persona rm <id>
persona archive <id>
persona roster save <name> --lenses a,b,c [--personas id1,id2] [--use-case "..."]
persona home
```

Saved personas and rosters live in the global library at `~/.persona-lab/`, so a
roster saved in one repo is recallable by name from any other. Treat CLI output
as a starting point, not the final review.

The legacy planner `node scripts/persona-plan.mjs "<request>"` still exists but is superseded by the `persona` CLI.

## Autonomous council runs (AI User Personas app)

When the AI User Personas app is running, you can drive a full council review to
completion over its HTTP API instead of reporting inline. Use the
`/ai-persona-lab:run` command, or drive the API directly against
`${APP_URL:-http://localhost:3000}`:

```text
POST /api/councils/rosters            build a roster from saved library personas
POST /api/councils/runs               create a run {roster_id, request, level, runs_per_persona}
GET  /api/councils/{run_id}           read the bundle + command packet
PATCH /api/councils/{run_id}/status   ready -> running
POST /api/councils/{run_id}/findings  record findings (validated, batch-capable)
PUT  /api/councils/{run_id}/synthesis record synthesis; advances the run to complete
```

Drive it exactly as a manual panel: one INDEPENDENT subagent per persona pass
(no shared transcript), abstain over fabricate, at least one adversarial pass,
and preserve conflicts as `dissent_map` in the synthesis.

Hard budget gate: `total_passes = personas x runs_per_persona`. If it exceeds 20,
stop and get explicit confirmation before spawning subagents — each pass is a
real LLM call. Output is hypothesis, not validation.
