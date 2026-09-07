# Persona Review Operating Model

## Bottom Line

AI User Personas should become a local-first coordination system for launching
synthetic persona reviews at controlled depth, with repo-specific preset rosters,
explicit measurement plans, evidence provenance, and a small HTML coordination UI.

The first product should not be a generic agent builder. It should be a focused
persona and council workspace that can later export prompts, agent packages, and
evaluation fixtures when the workflow proves durable.

Recommended path:

1. Extend the current persona-lab and council model into first-class `roster`,
   `run`, `assignment`, `finding`, and `measurement_plan` records.
2. Generate a preset persona roster per repo from local docs, prior councils,
   memory, and user edits.
3. Support `low`, `medium`, and `high` review levels that control persona count,
   independence, verification depth, cost, and output rigor.
4. Add an HTML coordination UI before adding heavier agent-package export.
5. Use Prompt Builder for reusable prompt templates and regression scoring.
6. Use Agent Builder-style packaging only when councils need to become reusable
   agent harnesses outside this app.

Build plan is held. This document is the planning artifact, not implementation.

## Why This Exists

The last two months show the same workflow recurring across repos:

| Date | Context | Use | Impact |
| --- | --- | --- | --- |
| 2026-05-27 | ProductPilot | User asked to test different flows with a user persona panel. The closest active surface was `IntakeProgressPane`, so tests covered JTBD, QFD, Pugh, and agent-system intake routing. | Persona-panel thinking became deterministic component coverage instead of a loose review. |
| 2026-06-01 | AI User Personas | User asked to codify repeated "spin up personas to test UI" work into a Claude Code and Codex plugin. | Created `plugins/persona-lab` with host manifests, command, orchestrator, reviewer, selection reference, and deterministic planner script. |
| 2026-06-04 to 2026-06-09 | Easy Terminal and personal-agent work | Claude-side workflows used persona panels and one-agent-per-persona passes for UI dimensions, UX audits, advisory boards, and decision escalation. | Showed persona panels are useful beyond this repo, especially for UI and product judgment. |
| 2026-06-09 | AI User Personas and Rally workflows | User asked to use AI User Personas or synthetic personas as a Haiku-scale Rally test, potentially scaling to 10, 20, or 100 agents. | 10 Haiku persona reviewers completed with zero retries, 59 findings, full Rally lineage, and a GO signal for a 20-agent wave. |
| 2026-06-10 | build-loop-memory | Reviewer QC work defined how to certify LLM reviewer accuracy with golden sets, Wilson intervals, and TRUST / REJECT / ESCALATE decisions. | Established that reviewer panels need measurement gates, not just confidence prose. |

The pattern is strong enough to productize, but the product should preserve the
lesson from the June 9 panel: persona output is only useful when evidence quality,
synthetic disclosure, confidence, and measurement are visible.

## Current Assets

Existing repo assets:

- `docs/architecture.md`: local-first persona workspace with repository boundary.
- `docs/data-contracts.md`: canonical `Persona` JSON contract.
- `schemas/persona.schema.json`: V1 persona schema.
- `plugins/persona-lab/`: dual-host Claude Code and Codex plugin.
- `plugins/persona-lab/scripts/persona-plan.mjs`: deterministic first-pass planner.
- `councils/README.md`: decision council, strategy council, and UI-test council model.
- `councils/runs/haiku-scale-20260609-01/PANEL-REPORT.md`: 10-Haiku scale test result.

Adjacent local assets:

- `prompt-builder`: prompt classification, rewrite, scoring, comparison, and saved
  prompt versions.
- `agent-builder-platform`: local-first agent design, run, package, and shared
  `agent-spec` contract.
- `agent-builder/plugin`: companion method layer for agent harness design and
  evaluation without the full workbench.
- `build-loop-memory/experiments/review-qc`: reviewer quality control harness.

## Method And Source Basis

This plan uses the local Research and Build Loop posture:

- Research mode: compare current local evidence before choosing the architecture.
- Build Loop mode: hold implementation behind a phased plan with acceptance gates.
- Prompt Builder mode: treat prompts as reusable product artifacts, not ad hoc
  text.
- Agent Builder comparison: evaluate the local app/plugin surfaces as a possible
  packaging lane, not as the default implementation.

Primary evidence paths:

- `plugins/persona-lab/README.md`
- `plugins/persona-lab/skills/persona-lab/SKILL.md`
- `councils/README.md`
- `councils/runs/haiku-scale-20260609-01/PANEL-REPORT.md`
- `docs/architecture.md`
- `docs/data-contracts.md`
- `/Users/tyroneross/dev/git-folder/prompt-builder/README.md`
- `/Users/tyroneross/dev/git-folder/agent-builder-platform/README.md`
- `/Users/tyroneross/dev/git-folder/agent-builder/plugin/README.md`
- `/Users/tyroneross/dev/git-folder/build-loop-memory/experiments/review-qc/2026-06-10-review-qc-findings.md`

## Product Concept

The app should answer five questions:

1. Which persona perspectives should inspect this artifact?
2. What can each persona actually inspect?
3. What measurement plan defines success, failure, and trust?
4. What did the persona panel find, with evidence?
5. Did the panel improve real outcomes over time?

The core loop:

```text
request
  -> repo context + user overrides
  -> preset or generated roster
  -> level selection: low / medium / high
  -> measurement plan
  -> independent persona assignments
  -> findings with evidence and confidence
  -> synthesis, dissent, next actions
  -> outcome tracking against later real evidence
```

## Preset Persona Rosters

Each repo should have a default roster that can be generated and then edited.

Generation inputs:

- `README`, `package.json`, `pyproject.toml`, app docs, and architecture docs.
- Saved personas in `data/personas.json`.
- Prior council reports under `councils/`.
- Build-loop memory and Codex memory summaries for that repo.
- User-provided roles, target buyers, users, reviewers, or constraints.

Stored shape:

```ts
type RepoPersonaRoster = {
  id: string;
  repo_path: string;
  repo_slug: string;
  source_summary: string;
  personas: RosterPersona[];
  default_levels: {
    low: string[];
    medium: string[];
    high: string[];
  };
  generated_from: string[];
  user_overrides: string[];
  updated_at: string;
};
```

Roster persona fields:

```ts
type RosterPersona = {
  id: string;
  name: string;
  lens: "user" | "buyer" | "operator" | "product" | "design" | "engineering" |
    "data" | "revenue" | "risk" | "support" | "executive" | "domain";
  role: string;
  job_to_be_done: string;
  decision_power: string;
  failure_modes: string[];
  evidence_expectations: string[];
  default_use_cases: string[];
};
```

The user can override the roster at run time:

- Add a one-off persona.
- Exclude a persona.
- Pin a persona into every future review for that repo.
- Change depth level for the current run only.
- Promote a one-off persona into the repo preset.

## Review Levels

Depth should be a first-class user choice.

| Level | Persona count | Best for | Execution | Output | Tradeoff |
| --- | ---: | --- | --- | --- | --- |
| Low | 2 to 3 | Quick sanity checks, early UI copy, obvious workflow gaps | Sequential or small parallel set, local evidence only | Short finding list and top recommendation | Fast and cheap, but weak coverage and weaker independence. |
| Medium | 4 to 7 | Product/UI review, feature plan review, pre-ship workflow check | Independent persona passes, measurement plan, repo/browser inspection when available | Prioritized synthesis, persona-specific findings, assumptions | Best default balance. More cost than low, but much better lens coverage. |
| High | 8 to 20 | Major release, strategy decision, trust/safety review, Rally scale test | Parallel agents or Rally wave, pre-registered measurement plan, reviewer QC, source audit | Full report, dissent map, severity tally, evidence matrix, outcome log | Strongest signal, but expensive and needs coordination controls. |

High can later support 100-agent experiments, but only as waves. The June 9 panel
showed Rally held at 10 concurrent Haiku agents; the panel recommended waves of
roughly 15 to 20 for larger runs because host concurrency is the likely limit.

## Use Cases

Primary use cases:

- UI review: personas attempt a workflow and report friction.
- Product review: personas test whether the value proposition fits their needs.
- Decision council: personas rank, veto, and explain options.
- Strategy council: personas debate market, GTM, or roadmap choices.
- Prompt review: personas inspect prompt behavior and output expectations.
- Code or architecture review: personas represent operators, maintainers, users,
  support, and risk owners.
- Research artifact review: personas evaluate whether evidence supports a claim.
- Competitive review: personas compare alternatives from buyer, user, and field
  lenses.

The app should keep council type separate from depth. Example: a decision council
can run at low, medium, or high.

## Measurement Plan

Every medium or high run should create a measurement plan before launching.

Minimum fields:

```ts
type PersonaMeasurementPlan = {
  id: string;
  run_id: string;
  decision_supported: string;
  target_artifact: string;
  success_signals: string[];
  failure_signals: string[];
  evidence_required: string[];
  confidence_policy: string;
  synthetic_policy: string;
  reviewer_quality_gate?: string;
  pre_registered_at: string;
};
```

Minimum metrics:

- Task completion: can the persona complete the intended action?
- Comprehension: does the persona understand what to do and why?
- Friction: what slows, blocks, or confuses the persona?
- Trust: what makes the persona doubt the product, data, or next step?
- Risk: what could create privacy, security, legal, operational, or brand harm?
- Business fit: does the experience support the intended product outcome?

High-level runs should add:

- Predicted outcome before review.
- Dissent capture.
- Reviewer accuracy plan when a labeled golden set exists.
- Post-run outcome tracking against later real user, support, sales, or analytics
  evidence.

## Evidence And Trust Requirements

The June 9 panel's strongest finding was evidence provenance. This should become
part of the product contract.

Required future changes:

- Require `source_uri` for real-source evidence types.
- Add `behavior_source`: `real_users`, `synthesized`, `expert_opinion`, or `mixed`.
- Add `is_synthetic_disclosed`.
- Split `confidence` into `evidence_confidence` and `synthesis_confidence`.
- Allow goals, frustrations, scenarios, needs, and findings to cite `evidence_ids`.
- Store `coverage_count` where one persona claim is based on multiple evidence
  samples.
- Auto-mark personas with majority synthetic evidence as `draft` unless a user
  explicitly accepts the limitation.

These changes should happen before this app is used to support high-stakes
product, compliance, investment, or GTM decisions.

## HTML Coordination UI

The first coordination UI can be a Next.js route rendered as ordinary HTML. It
does not need a complex canvas.

Suggested route:

- `/councils`
- `/councils/new`
- `/councils/[runId]`

Core layout:

```text
Header: repo, target artifact, run level, status, cost/time estimate

Left rail:
  repo roster
  selected personas
  one-off persona override
  low / medium / high selector

Center:
  request box
  target files / URL / screenshot / data sources
  measurement plan
  launch readiness checklist
  live assignment table

Right rail:
  Rally events or local run events
  evidence gaps
  reviewer confidence / QC state
  synthesis status

Bottom:
  priority findings
  dissent map
  recommended next actions
  export buttons
```

Important UI states:

- Draft: roster and plan editable.
- Ready: access checks pass and measurement plan is complete.
- Running: persona assignment status and partial artifacts visible.
- Needs evidence: run paused or downgraded because required access is missing.
- Synthesizing: findings landed, synthesis pending.
- Complete: report, findings, dissent, and next actions available.
- Follow-up: user can convert findings into build-loop tasks.

The UI should make synthetic status obvious. A hidden badge is not enough. Use a
structured warning block when a run or persona is mostly synthetic.

## Options And Tradeoffs

### Option A: Native AI User Personas Only

Use the current app, persona-lab plugin, and council data model.

Best when:

- The goal is focused persona review.
- The app should stay simple and local-first.
- The user wants fast iteration inside this repo.

Benefits:

- Smallest implementation.
- Lowest dependency risk.
- Clear product identity.
- Easy to tie runs to local repo artifacts and Rally facts.

Costs:

- Prompt quality and reuse depend on local discipline.
- Agent package export is manual.
- Less useful if the same council needs to run across many host runtimes.

Expected outcome:

- Faster useful product.
- Best first build.

### Option B: Native App Plus Prompt Builder

Use Prompt Builder to score and improve reusable prompts for selection,
assignment, review, synthesis, and judge/QC prompts.

Best when:

- Persona outputs need to become repeatable.
- The app needs low/medium/high prompt variants.
- Prompt changes should be versioned and regression-checked.

Benefits:

- Better structured prompts.
- Quality scoring across accuracy, clarity, constraints, determinism, and
  completeness.
- Safer prompt iteration.
- Project-local prompt library can preserve versions.

Costs:

- Adds an extra design step before execution.
- Does not execute reviews by itself.
- Scores are prompt-quality signals, not proof that persona findings are true.

Expected outcome:

- Better consistency and less prompt drift.
- Recommended for medium and high runs.

### Option C: Native App Plus Agent Builder-Style Packaging

Use Agent Builder concepts for manifest-backed council packages, setup checks,
evals, runtime adapters, and exportable agent structures.

Best when:

- Councils become reusable harnesses across repos.
- A persona council needs install checks, golden tasks, or export.
- Multiple host runtimes should run the same council.

Benefits:

- Strong packaging discipline.
- Clear runtime contracts.
- Built-in place for evals, regression scenarios, setup checks, and memory.
- Better path to reusable council products.

Costs:

- Heavier architecture.
- More files and concepts than the current app needs.
- Risk of turning a focused persona workspace into a generic agent workbench.

Expected outcome:

- Valuable later, but not the V1 default.

### Option D: Full Agent Builder First

Treat persona councils as generated agent graphs from the beginning.

Best when:

- The primary product is reusable agent harness design, not persona review.

Benefits:

- Most general.
- Strongest export and eval story.

Costs:

- Overbuilt for current evidence.
- Slower path to a useful persona review product.
- More likely to blur the app's job.

Expected outcome:

- Not recommended for the first build.

## Outcome Comparison

| Setup | Expected quality | Expected speed | Reuse | Operational complexity | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Native only | Medium, depends on local prompt discipline | Fastest | Repo-local | Low | Best V1 baseline. |
| Native + Prompt Builder | Higher consistency and better prompt regression control | Slightly slower at setup, faster after templates stabilize | Reusable prompt library | Medium-low | Recommended for medium/high runs. |
| Native + Agent Builder-style export | Higher packaging rigor and eval discipline | Slower | Cross-repo and cross-host | Medium-high | Add after run model proves useful. |
| Full Agent Builder first | Potentially high, but generalized too early | Slowest | Highest | High | Defer. |

What changes with Prompt Builder:

- Persona-selection prompts can be scored and versioned.
- Low/medium/high prompt variants can be tuned to model tier.
- Assignment and synthesis prompts can use explicit acceptance criteria.
- Prompt regressions become visible before a run.

What does not change with Prompt Builder:

- It does not verify that findings are true.
- It does not run the panel.
- It does not replace evidence provenance or reviewer QC.

What changes with Agent Builder:

- A council can become an exportable package with manifest, prompts, evals,
  setup checks, runtime notes, and memory.
- Reusable council patterns can move across repos and hosts.
- High-level councils can gain package-level regression scenarios.

What does not change with Agent Builder:

- It does not remove the need for repo-specific rosters.
- It does not solve evidence quality by itself.
- It should not be the storage or UI model for V1.

## Recommended Architecture

Use a layered model:

```text
AI User Personas app
  owns rosters, runs, assignments, findings, synthesis, and UI

persona-lab plugin
  owns host-neutral review method and fast deterministic planning

Prompt Builder
  improves and versions reusable prompts for medium/high runs

Agent Builder-style package export
  optional later lane for reusable council harnesses

Rally
  optional coordination substrate for multi-agent runs

build-loop-memory / Codex memory
  source of prior evidence and post-run lessons
```

This avoids coupling the first app to a general agent platform while keeping a
clean path to packaging later.

## Data Model Extensions

New entities:

```ts
type PersonaReviewRun = {
  id: string;
  repo_path: string;
  request: string;
  council_type: "ui_test" | "decision" | "strategy" | "prompt" | "research" |
    "architecture" | "competitive";
  level: "low" | "medium" | "high";
  target_artifacts: string[];
  roster_id: string;
  persona_ids: string[];
  measurement_plan_id: string;
  status: "draft" | "ready" | "running" | "needs_evidence" | "synthesizing" |
    "complete" | "archived";
  coordination_mode: "local" | "host_subagents" | "rally";
  created_at: string;
  updated_at: string;
};
```

```ts
type PersonaAssignment = {
  id: string;
  run_id: string;
  persona_id: string;
  prompt_version_id?: string;
  model_tier: "haiku" | "sonnet" | "opus" | "frontier" | "human";
  status: "queued" | "running" | "landed" | "failed" | "skipped";
  output_path?: string;
  evidence_gaps: string[];
  error?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
};
```

```ts
type PersonaFinding = {
  id: string;
  run_id: string;
  assignment_id: string;
  persona_id: string;
  severity: "critical" | "high" | "medium" | "low";
  claim: string;
  evidence_ids: string[];
  source_uris: string[];
  assumptions: string[];
  evidence_confidence: number;
  synthesis_confidence: number;
  behavior_source: "real_users" | "synthesized" | "expert_opinion" | "mixed";
  is_synthetic_disclosed: boolean;
  recommended_action: string;
  created_at: string;
};
```

## Build Plan Status

The first product slice is now implemented locally. The remaining backlog is
focused on live launch, reviewer QC, and later package reuse.

### Phase 1: Contracts And Local Storage

Status: landed.

- Added roster and review-run schemas.
- Added council domain contracts for rosters, runs, assignments, findings,
  measurement plans, synthesis, prompt versions, outcome comparisons, and
  events.
- Added local JSON storage behind repository interfaces.
- Removed live fixture seeding from the app. Historical council artifacts remain
  available for audit context, but runtime rosters and runs must come from
  local JSON persistence.

Acceptance:

- Typecheck passes.
- Example run renders through `/councils/run_haiku-scale_20260609`.
- Existing persona UI still works.

### Phase 2: Coordination UI

Status: landed.

- Added `/councils` run list.
- Added `/councils/new` with request, level, roster selection, target artifacts,
  and measurement plan.
- Added `/councils/[runId]` with status actions, assignment table, evidence
  gaps, findings, synthesis, command packet, comparison notes, markdown export,
  and Agent Builder-style package export.

Acceptance:

- User can create a draft run without launching agents.
- Synthetic and missing-evidence states are visible.
- Low/medium/high changes persona count and required readiness checks.

### Phase 3: Persona Lab Integration

Status: partially landed.

- Wired `persona-plan.mjs` output into run draft creation.
- Added run-scoped prompt versions and Prompt Builder comparison display.
- Actual launch remains manual through generated command packets.

Acceptance:

- A request can produce a draft roster, measurement plan, and assignment list.
- Prompt versions are traceable.
- No review is claimed as run unless an assignment artifact lands.

### Phase 4: Launch And Rally Coordination

Status: command-packet lane landed; live launch remains open.

- Local/manual and Rally command packets are generated from run state.
- Live low/medium/high launch adapters remain gated until explicit approval,
  cost controls, and rate limits are added.
- Assignment artifacts and run events are represented in the domain; live
  assignment ingestion remains open.

Acceptance:

- At least one low run completes end to end.
- At least one medium or high run records independent assignment artifacts.
- Rally runs preserve lineage when used.

### Phase 5: Reviewer QC And Outcome Tracking

Status: partially landed.

- Added outcome-comparison records for baseline vs Prompt Builder and
  Agent Builder-style reuse notes.
- Golden tasks, reviewer quality certification, and later-real-evidence
  prediction tracking remain open.

Acceptance:

- High-level run can show whether reviewer accuracy is certified or not.
- The app separates persona confidence from evidence quality.

### Phase 6: Optional Agent Builder Export

Status: first local export landed.

- Added Agent Builder-style JSON package export from run detail.
- Export remains optional and downstream from native app storage.

Acceptance:

- Exported package is self-contained.
- Export does not become the primary storage model.

## Open Decisions

- Whether to split `data/council-runs.json` by run if merge conflicts or file
  size become real constraints.
- Whether high-level Rally runs should stay command-packet-only or gain an
  explicit live-launch approval flow.
- Whether Prompt Builder scoring should happen at prompt-authoring time only or
  before every medium/high run.
- Whether Agent Builder export should target the current `agent-builder-platform`
  `agent-spec` package or remain a simpler local bundle first.
- Whether reviewer QC belongs in this app or should call the existing
  build-loop-memory review-qc harness.

## Recommendation

Build the focused native app first, with Prompt Builder as an optional quality
layer and Agent Builder-style packaging as a later export lane.

The product should optimize for useful, trustworthy persona review, not maximum
agent architecture generality. The evidence from prior runs says the valuable
thing is independent persona perspective plus measurement and provenance. The
coordination UI should make that visible before the system tries to become a
general-purpose agent workbench.
