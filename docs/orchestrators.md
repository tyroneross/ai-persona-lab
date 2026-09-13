# Orchestrators

Every persona session is run by an orchestrator selected by task type. The
orchestrator holds the end-to-end vision — who the end customer is, what they are
trying to accomplish, and what the best result for them looks like — and settles all
of that **before** a single persona is chosen.

Personas were always the easy part. What was missing was somebody accountable for the
outcome: a UI review and a pricing decision want different leads, different definitions
of "best outcome", and different people to hand the recommendations to, and none of
that is a property of the roster.

```bash
persona orchestrate "<task>" [--lane <id>] [--artifact <slug>] [--project <name>] [--count N] [--json]
persona orchestrate lanes [--json]
```

The command is deterministic and makes no model calls. It returns a plan the LLM host
executes; `execution` is always `plan-only`.

## The lanes

| Lane | Orchestrator is accountable for | Resolves on |
|---|---|---|
| `ui-ux-design` | UI/UX design lead accountable for the end user's task success, comprehension, and trust in the interface. | ui, ux, interface, screen, flow, onboarding, dashboard, component |
| `product` | Product manager accountable for whether this change creates enough user value to earn the next release, and for the quality of the decision behind it. | product, roadmap, prioritize, prioritization, feature, prd, spec, scope |
| `strategy` | Business strategist accountable for whether this move improves the company's position and survives a competitor who is paying attention. | strategy, strategic, business model, market, competition, competitive, competitor, positioning |
| `engineering` | Engineering lead accountable for whether this system keeps working for the people who depend on it, under change and under attack. | architecture, refactor, migration, api, schema, database, performance, latency |
| `marketing` | Marketing lead accountable for whether the right audience understands the offer, believes it, and acts on it. | marketing, messaging, copy, landing page, campaign, launch announcement, brand, content |
| `general` | General review orchestrator accountable for naming the real end customer and the real decision before any persona is chosen. | nothing — the fallback when no other lane scores |

Resolution is keyword scoring over the task: the highest-scoring lane leads, ties break
on registry order so the same task always resolves the same way, and a task that matches
nothing falls back to `general` rather than guessing. The runner-up is reported in
`lane.resolution.alternatives` — a task that scores 4 on product and 3 on strategy is a
task where the lead is a judgement call, and hiding that hides the judgement.

`--lane <id>` always wins. A human who names the discipline is not overruled by a
keyword count.

## What each lane optimises for, and who receives its output

| Lane | Best outcome means | Recommendations go to |
|---|---|---|
| `ui-ux-design` | Task completion, Comprehension, Trust, Accessibility, Friction cost | `build-loop:implementer`, `build-loop:design-contract-specialist`, `ibr:design-validator`, `design owner` |
| `product` | User value, Retention and adoption, Decision quality, Opportunity cost, Falsifiability | `prd-builder`, `build-loop:run`, `product owner`, `research:research` |
| `strategy` | Market position, Defensibility, Unit economics, Risk, Reversibility | `decision owner`, `research:research`, `prd-builder`, `build-loop:run` |
| `engineering` | Correctness, Failure behaviour, Blast radius, Changeability, Security and privacy | `build-loop:run`, `navgator:architecture-planner`, `build-loop:security-reviewer`, `engineering owner` |
| `marketing` | Comprehension, Believability, Differentiation, Action, Integrity | `spectra:marketing-planner`, `my-writing-style`, `marketing owner`, `research:research` |
| `general` | The end customer is named, not implied., The decision this session enables is stated, along with who makes it., Success and failure are both observable rather than rhetorical., Findings are separated into defects, which are verified, and positions, which are decided., Conflicts between personas are preserved as tradeoffs rather than averaged. | `requesting owner`, `build-loop:run` |

Consumers are the default routing table for the recommendation packet, not a
restriction. Name a different consumer when the work genuinely belongs elsewhere — but
name one. A recommendation with no named consumer is a note, and notes do not get
executed.

## The outcome frame

Every lane carries an ordered set of questions the orchestrator answers **in writing,
before selecting personas**. They are the feature. A panel convened for an unnamed
customer produces findings nobody can act on, and you do not discover that until after
five personas have spent their first look.

The general lane's frame is the shared shape every lane specialises:

1. Who is the end customer of this work, named specifically enough to disagree with?
2. What is that customer trying to accomplish, in their words rather than the product's?
3. What is the ultimate objective this work serves, beyond shipping the change?
4. What does the best outcome look like for that customer, stated as something observable?
5. What would count as failure, abandonment, or loss of trust?
6. What decision must this session enable, and who makes it?

Where the request and the artifact cannot answer a question, the orchestrator writes the
assumption it is proceeding on and marks it as an assumption. Skipping the question is
not an option; the answers become the `outcome_frame` block of the recommendation packet,
where an unanswered question fails validation rather than disappearing.

## The eleven steps

The protocol is defined once, in
[`skills/persona-lab/references/orchestrator-protocol.md`](../skills/persona-lab/references/orchestrator-protocol.md),
and every orchestrator agent cites it rather than restating it.

| Step | What happens |
|---|---|
| 0 | Resolve the lane and hand off to its agent, or continue as that lane. |
| 1 | Answer the outcome frame in writing. |
| 2 | Select personas by technique, not headcount. Red-team always. |
| 3 | Freeze the artifact, record the version, open the run. |
| 4 | Define measurement against the lane's outcome criteria. |
| 5 | Run independent blind passes; each persona writes its encounter before returning. |
| 6 | Adjudicate every reported defect against the artifact itself. |
| 7 | Synthesize, preserving conflicts rather than averaging them. |
| 8 | Write the recommendation packet — a named consumer per item. |
| 9 | Decide whether a lane iteration trigger fired; if so, open a second run. |
| 10 | Document: close, recommend, lesson, findings document. |

## Recommendation packets

```bash
persona run recommend <run_id> <packet.json|-> [--validate-only] [--json]
persona run recommendations <run_id> [--json]
```

Schema: [`schemas/recommendation-packet.schema.json`](../schemas/recommendation-packet.schema.json).
Stored append-only at `~/.persona-lab/runs/<run_id>/recommendations/<packet_id>.json`; the
latest is computed by sorting rather than stored in a pointer file, because a pointer is
mutable state that can disagree with the directory it points into.

Each recommendation carries the findings it rests on, severity, provenance
(`evidence-grounded` or `assumption`), its adjudication disposition, a consumer
(`agent` / `skill` / `human` plus a name), an observable acceptance check, and a status.

Three rules the writer enforces rather than suggests:

- A finding the adjudicator **refuted** cannot be `accepted` or `executed`. It may be
  recorded as `rejected`; that is the honest version of the same pair.
- A recommendation whose provenance is `assumption` cannot claim `source-confirmed`.
  A summary never promotes an assumption to evidence.
- The packet's `artifact_version` must match the run. A packet stamped with a newer
  version silently claims findings about an artifact no persona saw.

A **closed** run still accepts a packet: recommendations are written after the
adjudication and synthesis they summarise, and requiring an open run would force the
packet to exist before its own reasoning. An **abandoned** run does not — a panel nobody
finished should not be issuing work orders to other agents.

## Iterating with personas

Each lane declares `iteration_triggers`. If none fired, the orchestrator says so and
stops; a second round on an unchanged artifact costs real model calls and answers a
question nobody asked.

When one did fire, the second round is a **second run**, never an edit of the first.
Recall stays intact: a `recall: none` persona is dispatched blind again, and any informed
pass names the exact prior `encounter_id`s it was shown — other personas' positions, never
its own history. Rounds are compared at the orchestrator level, where both are visible,
and the packet records `iteration.round`, `iteration.prior_run_ids` and the trigger.

What moved because the artifact changed and what moved because a persona was shown an
argument are different results. Only one of them is evidence.

## Lenny's Podcast guests in orchestration

Each lane declares `recommended_guest_categories`, and `planOrchestration` returns
`recommended_guests` ranked by how many of a guest's own areas the task's words actually
match. A guest outside the lane's categories still surfaces when the task matches its
areas strongly — a positioning question can arrive dressed as an onboarding screen — and
is flagged `in_lane_category: false`.

Reviewed source principles inform a seat. They never impersonate the guest, never claim
the guest endorsed the work, and never establish real user behaviour. See
[professional archetypes](archetypes.md#lennys-podcast-guest-registry).

## Adding a lane

1. Add one entry to `lib/data/orchestrator-lanes.json` with every field the existing
   lanes carry: `id`, `title`, `agent_file`, `orchestrator`, `keywords`, `task_shapes`,
   `outcome_frame`, `outcome_criteria`, `persona_selection`, `recommendation_consumers`,
   `iteration_triggers`, `documentation`.
2. Run `node scripts/sync-orchestrator-agents.mjs` to render its agent.
3. Run `npm test`. The suite asserts the lane carries every required field, that its
   agent file exists, and that the file on disk byte-matches what the generator would
   write now. `node scripts/sync-orchestrator-agents.mjs --check` reports drift without
   writing.

The fallback lane's agent (`agents/persona-panel-orchestrator.md`) is hand-written on
purpose: it routes between lanes rather than describing one discipline.

## The bound on every claim

The method is largely unvalidated — one source study, no human calibration, no baseline
comparison ([method limits](LIMITATIONS.md)). Orchestration changes who is accountable
for a panel's output; it does not change what a panel's output is worth. Every report is
still **hypothesis, not validation**: simulated participants giving reactions, not
recruited users completing tasks under observation.
