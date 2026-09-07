# Plan: Persona Review Capability

<!-- checklist
Item 1 - Auth guard: N/A: local single-user feature, no auth guard or authenticated route is in P0 scope.
Item 2 - External APIs: N/A: no new external API calls in P0/P1. Agent launch and external model calls are manual or generated-command lanes until explicitly approved.
Item 3 - Rate-limit criterion: N/A: no paid API calls in P0/P1. Later live-agent adapters must add per-run and per-hour limits before execution.
Item 4 - Discoverability: Add top nav item "Councils" at /councils; empty state headline "No persona reviews yet" with CTA "Plan a review"; first-run hint appears in /councils/new above the review-level selector.
Item 5 - Server/client boundary: Current repo only uses "use client" in components/PersonaForm.tsx. P0 keeps shared types in src/lib/council.ts. If file-backed writes land in P1, put server-only storage in src/lib/council-repository.server.ts with import "server-only" and expose mutations through app/councils/actions.ts.
Item 6 - Concurrency: Local JSON write paths use optimistic updated_at guards plus temp-file rename. No multi-user conflict resolution in V1.
Item 7 - Observability: Store local run events in the review-run event log: operation, actor, run_id, status_before, status_after, outcome, created_at. No external telemetry.
Item 8 - Input validation: Validate council write inputs with src/lib/council-validation.ts guard functions before repository writes. No new route handlers in P0.
Item 9 - Stable ID traceability: Example P0 chain: U-02 -> F-03 -> D-02/D-04 -> S-02 -> T-04 -> A-01.
Item 10 - JSON spec object: Present in "Spec Object (JSON)" with needs, features, data_points, tests, and adrs.
Item 11 - Blocking-and-novel question gate: No blocking open questions. Reversible product defaults are labelled [ASSUMED] in the plan.
Item 12 - Low-reversibility ADRs: Public run/roster schemas and local persistence contract are covered by ADR-01 and ADR-02.
Item 13 - Analytical lens: QFD for need-to-feature mapping; Pugh for Native vs Prompt Builder vs Agent Builder option comparison.
Item 14 - Handoff document: docs/plans/persona-review-capability.handoff.md created with feature, ADR, and test pointers.
Item 15 - Synthesis dimensions: UI work package WP-03 includes placement, cta_tier, copy_tone, visual_weight, and empty_state.
Item 16 - Risk reason: WP-01/WP-02 use risk_reason: persistence contract. WP-03/WP-05 use risk_reason: user trust claim.
Item 17 - UI input/output contract: Present in "UI Input/Output Contract".
Item 18 - Dispatch tier: Each work package includes dispatch_tier with one-line justification.
-->

## Goal

Build AI User Personas into a local-first persona review workspace: generate or
curate repo-specific persona rosters, plan low/medium/high synthetic persona
reviews, coordinate assignments in an HTML UI, preserve evidence and trust
metadata, and compare outcomes with and without Prompt Builder or Agent
Builder-style packaging.

The useful V1 is not a generic agent workbench. It is a focused council
workflow that turns a request into a roster, measurement plan, assignments,
findings, synthesis, and outcome tracking.

## Spec Object (JSON)

```json
{
  "needs": [
    {
      "id": "U-01",
      "priority": "P0",
      "need": "Create and maintain a repo-specific preset persona roster."
    },
    {
      "id": "U-02",
      "priority": "P0",
      "need": "Plan a persona review at low, medium, or high depth before launch."
    },
    {
      "id": "U-03",
      "priority": "P0",
      "need": "Inspect review status, assignments, evidence gaps, and findings in one coordination UI."
    },
    {
      "id": "U-04",
      "priority": "P0",
      "need": "Make synthetic status, evidence provenance, and reviewer confidence visible."
    },
    {
      "id": "U-05",
      "priority": "P1",
      "need": "Compare baseline reviews against Prompt Builder-enhanced prompts and Agent Builder-style exported packages."
    }
  ],
  "features": [
    {
      "id": "F-01",
      "priority": "P0",
      "name": "Council domain contracts",
      "needs": ["U-01", "U-02", "U-04"],
      "data_points": ["D-01", "D-02", "D-03", "D-04", "D-05"],
      "tests": ["T-01", "T-02"]
    },
    {
      "id": "F-02",
      "priority": "P0",
      "name": "Local roster and run repositories",
      "needs": ["U-01", "U-02"],
      "data_points": ["D-01", "D-02", "D-06"],
      "tests": ["T-02", "T-03"],
      "adr": "ADR-01"
    },
    {
      "id": "F-03",
      "priority": "P0",
      "name": "Councils coordination UI",
      "needs": ["U-02", "U-03", "U-04"],
      "data_points": ["D-01", "D-02", "D-03", "D-04", "D-06"],
      "tests": ["T-04", "T-05"],
      "adr": "ADR-02"
    },
    {
      "id": "F-04",
      "priority": "P0",
      "name": "persona-plan draft adapter",
      "needs": ["U-01", "U-02"],
      "data_points": ["D-01", "D-02", "D-04"],
      "tests": ["T-06"]
    },
    {
      "id": "F-05",
      "priority": "P1",
      "name": "Launch adapters and command packets",
      "needs": ["U-03", "U-04"],
      "data_points": ["D-03", "D-06"],
      "tests": ["T-07"],
      "adr": "ADR-03"
    },
    {
      "id": "F-06",
      "priority": "P1",
      "name": "Prompt Builder comparison lane",
      "needs": ["U-05"],
      "data_points": ["D-05", "D-07"],
      "tests": ["T-08"],
      "adr": "ADR-04"
    },
    {
      "id": "F-07",
      "priority": "P1",
      "name": "Agent Builder-style export lane",
      "needs": ["U-05"],
      "data_points": ["D-05", "D-07"],
      "tests": ["T-09"],
      "adr": "ADR-05"
    }
  ],
  "data_points": [
    {
      "id": "D-01",
      "name": "RepoPersonaRoster",
      "semantics": "Repo path, source summary, selected personas, defaults per review level, generated_from, user_overrides, timestamps."
    },
    {
      "id": "D-02",
      "name": "PersonaReviewRun",
      "semantics": "Request, council type, target artifacts, level, roster, selected personas, status, coordination mode, timestamps."
    },
    {
      "id": "D-03",
      "name": "PersonaAssignment",
      "semantics": "One persona's assigned prompt, model tier, status, output path, evidence gaps, and failure state."
    },
    {
      "id": "D-04",
      "name": "PersonaMeasurementPlan",
      "semantics": "Decision supported, success signals, failure signals, evidence required, confidence policy, synthetic policy, quality gate."
    },
    {
      "id": "D-05",
      "name": "PromptVersion",
      "semantics": "Prompt family, variant, model tier, level, score, source tool, and changelog."
    },
    {
      "id": "D-06",
      "name": "RunEvent",
      "semantics": "Local audit log for draft, readiness, launch, findings, synthesis, evidence gaps, and completion."
    },
    {
      "id": "D-07",
      "name": "OutcomeComparison",
      "semantics": "Comparison of baseline, Prompt Builder, and Agent Builder-style runs on coverage, evidence quality, actionability, cost, and reuse."
    }
  ],
  "tests": [
    {
      "id": "T-01",
      "name": "Schema/type contract check",
      "pass": "TypeScript accepts council domain types and local JSON persistence without widening to any."
    },
    {
      "id": "T-02",
      "name": "Repository unit checks",
      "pass": "Node tests cover create, update, status transition, optimistic conflict, archive, and export."
    },
    {
      "id": "T-03",
      "name": "Local JSON persistence smoke",
      "pass": "Repository writes temp file then renames, preserves ids, and rejects stale updated_at writes."
    },
    {
      "id": "T-04",
      "name": "Draft review creation",
      "pass": "User can create a draft medium review with selected personas and a complete measurement plan."
    },
    {
      "id": "T-05",
      "name": "Coordination UI states",
      "pass": "Draft, ready, running, needs evidence, synthesizing, complete, and archived states render without overlap or missing trust notices."
    },
    {
      "id": "T-06",
      "name": "persona-plan adapter smoke",
      "pass": "Adapter converts deterministic persona-plan output into roster and draft run records without shelling from client code."
    },
    {
      "id": "T-07",
      "name": "Launch adapter dry run",
      "pass": "Local/Rally adapters emit command packets and assignments; no live agent execution occurs without explicit approval."
    },
    {
      "id": "T-08",
      "name": "Prompt Builder comparison",
      "pass": "Same review request can record baseline prompt and Prompt Builder prompt scores with outcome deltas."
    },
    {
      "id": "T-09",
      "name": "Agent Builder export smoke",
      "pass": "Export includes manifest, prompts, eval notes, setup checks, and council memory pointers without becoming app storage."
    }
  ],
  "adrs": [
    {
      "id": "ADR-01",
      "decision": "Use local JSON persistence behind repository boundaries before database work."
    },
    {
      "id": "ADR-02",
      "decision": "The AI User Personas app owns rosters, runs, findings, synthesis, and UI state."
    },
    {
      "id": "ADR-03",
      "decision": "Generate command packets before enabling live agent launch from the UI."
    },
    {
      "id": "ADR-04",
      "decision": "Use Prompt Builder for prompt quality comparison, not as the run orchestrator."
    },
    {
      "id": "ADR-05",
      "decision": "Use Agent Builder-style export only after the native workflow proves useful."
    }
  ]
}
```

## Locked Decisions

| Decision | Status | Rationale |
| --- | --- | --- |
| Analytical lens: QFD plus Pugh | Locked | QFD maps user needs to product features; Pugh compares Native, Prompt Builder, and Agent Builder lanes. |
| Local-first V1 | Locked | Existing app architecture uses a local repository boundary and JSON persistence. |
| App owns council records | Locked | Roster, run, assignment, finding, synthesis, and outcome records are the product core. |
| Prompt Builder is a quality lane | Locked | It should score and version prompts for medium/high reviews, not replace run storage or UI. |
| Agent Builder-style export is P1/P2 | Locked | Useful for reusable packages later, but heavier than the V1 workflow needs. |
| Live agent launch is gated | Locked | The UI may generate commands first; actual multi-agent execution needs explicit user approval and rate/cost limits. |
| [ASSUMED: flat JSON files first] | Reversible default | Start with `data/council-rosters.json` and `data/council-runs.json`; split by run if file size or merge conflicts become real constraints. |

## Scope

### P0

- Add council domain contracts for rosters, review runs, assignments,
  measurement plans, findings, synthesis, events, prompt versions, and outcome
  comparisons.
- Add JSON schemas or structured validation guards for council records.
- Add local repository modules for rosters and review runs.
- Add `/councils`, `/councils/new`, and `/councils/[runId]` UI routes.
- Add level selection for low, medium, and high review depth.
- Add synthetic-status and evidence-gap warnings directly into the UI.
- Add a server-side or CLI-safe adapter around
  `plugins/persona-lab/scripts/persona-plan.mjs`.
- Add dry-run command packet generation for local/manual and Rally modes.

### P1

- Add Prompt Builder prompt-score recording and prompt-version comparison.
- Add outcome comparison records for baseline vs Prompt Builder vs Agent
  Builder-style runs.
- Add Agent Builder-style export of a council package.
- Add richer run-event filtering, dissent mapping, and follow-up task export.

### Out of scope

- Auth, accounts, billing, cloud sync, or multi-user permissions.
- A database migration before JSON storage proves insufficient.
- Browser-triggered live agent launch without a separate approval gate.
- Direct paid model calls from the app in P0/P1.
- Treating synthetic persona findings as real user evidence.
- Making Agent Builder the app's internal data model.

## Work Packages

| WP | Subject | Files owned | Depends on | Risk | dispatch_tier |
| --- | --- | --- | --- | --- | --- |
| WP-01 | `feat(councils): add domain contracts and schemas` | `src/lib/council.ts`, `schemas/persona-roster.schema.json`, `schemas/persona-review-run.schema.json` | none | risk_reason: persistence contract | sonnet - schema semantics need judgment and traceability. |
| WP-02 | `feat(councils): add local repositories and JSON persistence` | `src/lib/council-repository.ts`, `src/lib/council-repository.server.ts`, `data/council-rosters.json`, `data/council-runs.json` | WP-01 | risk_reason: persistence contract | sonnet - local persistence and conflict behavior need careful review. |
| WP-03 | `feat(councils): add coordination UI routes` | `app/councils/page.tsx`, `app/councils/new/page.tsx`, `app/councils/[runId]/page.tsx`, `components/*Council*.tsx`, `components/AppShell.tsx` | WP-01, WP-02 | risk_reason: user trust claim | sonnet - UI and trust states need product judgment. |
| WP-04 | `feat(councils): adapt persona-plan into draft rosters and runs` | `src/lib/persona-plan-adapter.ts`, `plugins/persona-lab/scripts/persona-plan.mjs` only if needed | WP-01, WP-02 | none | haiku - mostly deterministic adapter if script output is stable. |
| WP-05 | `feat(councils): add findings, synthesis, and outcome tracking` | `src/lib/council.ts`, `src/lib/council-repository.ts`, `components/*Finding*.tsx`, `components/*Synthesis*.tsx` | WP-03 | risk_reason: user trust claim | sonnet - evidence and confidence copy affects user trust. |
| WP-06 | `feat(councils): add prompt and package comparison lanes` | `src/lib/prompt-comparison.ts`, `src/lib/council-export.ts`, `exports/councils/`, docs | WP-05 | none | sonnet - integration boundary choice matters more than code volume. |

## Implementation Sequence

### WP-01: Contracts and Schemas

Build the council domain around stable IDs and explicit lifecycle state.

Required entities:

- `RepoPersonaRoster`
- `RosterPersona`
- `PersonaReviewRun`
- `PersonaAssignment`
- `PersonaFinding`
- `PersonaSynthesis`
- `PersonaMeasurementPlan`
- `PromptVersion`
- `RunEvent`
- `OutcomeComparison`

Rules:

- Run ids: `run_<repo-slug>_<yyyymmdd>_<8hex>`.
- Roster ids: `roster_<repo-slug>_<8hex>`.
- Assignment ids: `assignment_<run-id>_<persona-id>`.
- Findings must cite `assignment_id`, `persona_id`, severity, confidence, and
  at least one evidence or assumption marker.
- Synthetic evidence must remain visible through `behavior_source` and
  `is_synthetic_disclosed`.
- Do not remove the current `Persona` contract. Council contracts sit beside it.

Acceptance:

- `npm run typecheck`
- `node --test` for pure validation helpers, if helpers are added.
- `git diff --check`

### WP-02: Local Repositories and JSON Persistence

Add repository boundaries equivalent to the current persona repository.

Target modules:

- `src/lib/council-repository.ts`: repository interface and in-memory adapter.
- `src/lib/council-repository.server.ts`: file-backed server adapter.

Initial storage:

- `data/council-rosters.json`
- `data/council-runs.json`

Write behavior:

- Read current JSON.
- Validate input.
- Check `updated_at` on mutating writes.
- Write to temp file.
- Rename atomically.
- Append a `RunEvent` for every status transition.

Acceptance:

- Repository tests cover create, read, update, archive, export, stale write
  rejection, and invalid status transitions.
- Empty JSON files render empty UI states instead of hidden sample data.
- Persisted rosters and runs render through the UI without schema/type changes.

### WP-03: HTML Coordination UI

Add the actual product surface.

Routes:

- `/councils`: run dashboard.
- `/councils/new`: draft review setup.
- `/councils/[runId]`: run coordination, assignments, findings, synthesis, and
  outcome panel.

Navigation:

- Add `Councils` to `components/AppShell.tsx`.
- Keep `Personas` as the root landing surface until the councils workflow is
  stable.

synthesis_dimensions:

```yaml
placement: "AppShell top nav after Competitive Research; council pages use full-width constrained content under the existing shell"
cta_tier: "primary CTA on /councils empty state: Plan a review"
copy_tone: "direct product workflow labels, no marketing copy"
visual_weight: "status-first dashboard with compact panels, not hero layout"
empty_state: "headline No persona reviews yet, one CTA Plan a review, one sentence naming low/medium/high reviews"
```

Required states:

- Draft
- Ready
- Running
- Needs evidence
- Synthesizing
- Complete
- Archived

Required controls:

- Council type selector.
- Review level segmented control: low, medium, high.
- Roster picker with include/exclude and one-off persona override.
- Target artifact input for files, URLs, or free-text artifact descriptions.
- Measurement plan editor.
- Readiness checklist.
- Dry-run command packet viewer.

Acceptance:

- UI renders empty states and persisted local JSON data.
- `npm run typecheck`
- `npm run build`
- Browser verification at desktop and mobile widths once implementation starts.

### WP-04: Persona-Plan Adapter

Use the existing deterministic planner as a draft generator, but keep it out of
client components.

Adapter behavior:

- Accept repo path, request, level, council type, and optional user overrides.
- Run or import `plugins/persona-lab/scripts/persona-plan.mjs` from a server-only
  or CLI-safe path.
- Convert output into `RepoPersonaRoster`, `PersonaReviewRun`, and
  `PersonaMeasurementPlan` drafts.
- Preserve planner source and version in `generated_from`.

Do not:

- Shell out from browser/client code.
- Treat planner output as active without user review.
- Launch agents.

Acceptance:

- Deterministic smoke test converts a sample request into a draft medium run.
- Invalid planner output fails closed with a readable repository error.

### WP-05: Findings, Synthesis, QC, and Outcome Tracking

Make reviews useful after launch.

Finding fields:

- `id`
- `run_id`
- `assignment_id`
- `persona_id`
- `severity`
- `claim`
- `evidence_ids`
- `source_uris`
- `assumptions`
- `evidence_confidence`
- `synthesis_confidence`
- `recommended_action`

Synthesis fields:

- top findings
- dissent map
- evidence gaps
- confidence downgrade reasons
- follow-up build tasks
- decision recommendation

QC:

- Low: no formal QC, but synthetic and evidence gaps visible.
- Medium: required measurement plan and evidence-gap check.
- High: reviewer QC checklist, dissent capture, and outcome-comparison record.

Outcome tracking:

- Store whether the review led to a code change, product decision, prompt
  change, or rejected recommendation.
- Later compare against real user, support, sales, analytics, or code-review
  evidence when available.

Acceptance:

- Completed persisted run shows findings, dissent, and evidence gaps.
- Synthetic-heavy run displays warning block, not just a badge.
- Findings can be exported as Markdown.

### WP-06: Prompt Builder and Agent Builder Comparison Lanes

This work proves whether extra tooling improves outcomes.

Baseline lane:

- Native app prompt templates.
- No Prompt Builder score.
- No exported package.

Prompt Builder lane:

- Store prompt family and version for selection, assignment, synthesis, and QC.
- Record prompt score dimensions: clarity, constraints, determinism, completeness,
  model-tier fit, and evidence discipline.
- Compare review quality against baseline for the same request where practical.

Agent Builder-style lane:

- Export a council package after a completed run.
- Include manifest, prompts, eval notes, setup checks, runtime adapters, and
  memory pointers.
- Keep app storage native. The package is an export artifact, not the source of
  truth.

Comparison metrics:

- Coverage: number of distinct high-value findings.
- Evidence quality: cited source rate and synthetic disclosure rate.
- Actionability: number of findings converted into accepted next actions.
- Cost/time: prompt prep, run time, agent count, retry count.
- Reuse: whether the prompt/package can run again in another repo.

Acceptance:

- One completed run can record a baseline-vs-Prompt Builder comparison.
- Agent Builder-style export creates files without changing app storage.
- The UI labels comparison data as evaluation support, not proof of truth.

## F-Criteria

| Criterion | Pass condition | Grader |
| --- | --- | --- |
| Roster creation | User can create or generate a repo-specific roster with low/medium/high defaults. | Manual UI test plus repository test |
| Draft run creation | User can create a draft run with request, level, council type, targets, personas, and measurement plan. | Manual UI test plus repository test |
| Trust visibility | Synthetic status, evidence gaps, and confidence downgrades are visible on run detail. | Browser screenshot inspection |
| Dry-run launch | UI shows generated local/Rally command packet without executing agents. | Unit test plus manual UI test |
| Findings | Completed run displays persona findings, source links or assumption markers, severity, and recommended action. | Persisted run render test |
| Synthesis | Completed run displays top findings, dissent, evidence gaps, and next actions. | Persisted run render test |
| Prompt comparison | Prompt Builder lane can attach prompt score and outcome delta to a run. | Repository test |
| Export comparison | Agent Builder-style export writes package artifact without becoming app storage. | Smoke test |

## Q-Criteria

| Criterion | Pass condition | Grader |
| --- | --- | --- |
| TypeScript | `npm run typecheck` exits 0. | CLI |
| Build | `npm run build` exits 0 after UI work. | CLI |
| Whitespace | `git diff --check` exits 0. | CLI |
| No new runtime dependency by default | P0 uses Node, Next, React, TypeScript, and existing repo dependencies only. | `package.json` diff |
| Client/server boundary | No client component shells out or imports server-only storage. | Code review |
| Accessibility | Segmented controls, forms, status, warnings, and command packets have text labels and keyboard path. | Browser/manual check |
| Evidence discipline | Real-source claims require source URI or explicit assumption marker. | Repository validation |

## UI Input/Output Contract

| Surface | Inputs | Outputs | Data taxonomy | Operation | Component mapping | States | Modality | Validation/security | Traceability |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/councils` dashboard | Search, status filter, level filter, council type filter | Run list, status counts, evidence-gap count, CTA | inputs: scalar/view state; outputs: `PersonaReviewRun[]`, computed counts | Read/query | `CouncilDashboard`, `CouncilRunList`, `CouncilStatusSummary` | empty, populated, error | text/table; no chart required | read-only, no sensitive external calls | U-03, F-03, D-02, T-05 |
| `/councils/new` setup | Request text, council type, level, targets, roster selection, one-off persona, measurement plan fields | Draft run preview, selected personas, readiness checklist, command packet preview | inputs: persisted domain fields; outputs: `RepoPersonaRoster`, `PersonaReviewRun`, `PersonaMeasurementPlan` | Create draft | `CouncilRunForm`, `ReviewLevelControl`, `RosterPicker`, `MeasurementPlanEditor`, `ReadinessChecklist` | empty, editing, invalid, ready | text/forms; keyboard controls | validate required fields, block incomplete measurement plan for medium/high | U-01, U-02, F-01, F-03, D-01, D-02, D-04, T-04 |
| `/councils/[runId]` run detail | Status transition actions, assignment updates, findings import, synthesis update | Assignment table, findings list, evidence warnings, synthesis, outcome log | inputs: domain status/actions; outputs: assignments, findings, synthesis, events | Update run | `AssignmentTable`, `FindingList`, `EvidenceWarning`, `SynthesisPanel`, `OutcomePanel` | draft, ready, running, needs_evidence, synthesizing, complete, archived | text/table/markdown export | optimistic updated_at guard, no live launch without explicit command approval | U-03, U-04, F-05, D-03, D-06, T-05, T-07 |
| Command packet viewer | Coordination mode, selected assignments, target files | Shell commands or host instructions for manual execution | inputs: run config; outputs: generated text artifact | Generate/export | `CommandPacketViewer` | unavailable, ready, copied/exported | text with copy button | never auto-executes client-side; warns for high/costly runs | U-02, U-03, F-05, D-03, T-07 |
| Comparison panel | Baseline run, Prompt Builder prompt score, Agent Builder export result | Coverage/evidence/actionability/cost/reuse comparison | inputs: linked run ids and prompt versions; outputs: `OutcomeComparison` | Compare/export | `OutcomeComparisonPanel` | none, partial, complete | table/text | labels comparison as evaluation support, not truth proof | U-05, F-06, F-07, D-07, T-08, T-09 |

## Validation Plan

Run these after each implementation slice that touches code:

```bash
npm run typecheck
npm run build
git diff --check
```

Add focused tests as code appears:

```bash
node --test
node plugins/persona-lab/scripts/persona-plan.mjs "Review the councils workflow at medium depth"
```

Use browser verification after WP-03:

- `/councils` at desktop width.
- `/councils/new` at desktop and mobile width.
- `/councils/[runId]` with a persisted synthetic-heavy test run.
- Confirm warning text, forms, status controls, and tables do not overlap.

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| The app becomes a generic agent builder too early. | Medium | High | Keep P0 native to rosters, runs, assignments, findings, and synthesis. Export packages only in WP-06. |
| Synthetic findings are mistaken for real evidence. | High | High | Add behavior source, synthetic disclosure, confidence splits, and visible warning blocks. |
| Live agent launch creates cost or host-control problems. | Medium | High | Generate command packets first; require explicit approval before live launch. |
| JSON persistence creates merge conflicts or stale writes. | Medium | Medium | Use optimistic guards and temp-file rename; defer DB until conflict is real. |
| Prompt Builder score is overtrusted. | Medium | Medium | Treat scores as prompt quality signals, not factual truth. Compare against outcomes and evidence quality. |
| High-depth runs flood the UI. | Medium | Medium | Use assignment filters, severity grouping, top findings, and dissent map. |

## ADR-01: Local JSON Before Database

Decision: store council rosters and runs in local JSON behind repository
interfaces for V1.

Alternatives:

- Browser localStorage: simpler, but weak for repo files and Rally artifacts.
- SQLite: stronger, but adds migration and tooling work before the model is
  stable.
- Cloud database: out of scope for a local-first dogfood workspace.

Tradeoff:

- JSON is easiest to inspect, commit, and adjust while the domain model is still
  moving.
- JSON needs optimistic guards and may become noisy at scale.

Rollback path:

- Keep repository interfaces stable and swap storage to SQLite later.

## ADR-02: Native App Owns Council State

Decision: the AI User Personas app owns rosters, runs, assignments, findings,
synthesis, and outcome records.

Alternatives:

- Store everything in Agent Builder packages.
- Store everything as Rally facts.
- Store everything as Markdown reports.

Tradeoff:

- Native storage gives the UI a stable product model.
- Rally and packages remain integration/export surfaces.

Rollback path:

- Export current records to package or Markdown if the app model proves too
  narrow.

## ADR-03: Command Packets Before Live Launch

Decision: P0/P1 generate executable-looking local/Rally command packets, but do
not auto-launch agents from the browser.

Alternatives:

- Full browser-triggered launch.
- Manual instructions only.

Tradeoff:

- Command packets make the workflow concrete without taking on host control,
  cost, or concurrency risk.

Rollback path:

- Add a server-side launch adapter after command packets prove stable and rate
  limits are defined.

## ADR-04: Prompt Builder As Quality Lane

Decision: use Prompt Builder to score and version prompts for medium/high review
families.

Alternatives:

- Native prompts only.
- Prompt Builder as the orchestrator.

Tradeoff:

- Prompt Builder improves prompt discipline and comparison without replacing the
  app's run model.
- It adds one extra step for prompt design.

Rollback path:

- Keep native prompts as baseline and make Prompt Builder metadata optional.

## ADR-05: Agent Builder-Style Export Later

Decision: add export after the council workflow proves useful.

Alternatives:

- Start with full Agent Builder.
- Never export.

Tradeoff:

- Export gives a reuse path across repos and hosts.
- Starting there would overbuild the first product.

Rollback path:

- Leave exports as generated artifacts under `exports/councils/`; deleting the
  export lane does not affect native storage.

## Open Questions

No blocking questions.

[ASSUMED: For V1, use flat JSON files instead of per-run files.] This changes
only storage adapter internals and does not alter P0 acceptance tests.

[ASSUMED: The first UI should not execute agents.] This protects cost and host
control while still allowing command packet validation.

## Out of Scope

- Auth, accounts, billing, cloud sync, or multi-user permissions.
- A database migration before JSON storage proves insufficient.
- Browser-triggered live agent launch without a separate approval gate.
- Direct paid model calls from the app in P0/P1.
- Treating synthetic persona findings as real user evidence.
- Making Agent Builder the app's internal data model.
