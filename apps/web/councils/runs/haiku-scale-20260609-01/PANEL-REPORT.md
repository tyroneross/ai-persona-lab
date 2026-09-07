# Haiku-Fleet Persona Panel — Run haiku-scale-20260609-01 (2026-06-09)

10 Haiku-tier persona reviewers, fanned out in one batch via rally-workflows (Tier-1,
descriptor linted clean, MECE write boundaries). Question put to the panel: **what would
make this persona workspace more effective at producing useful, trustworthy
synthetic-user feedback?** Synthesis by the orchestrating session (Fable).

## Scale-test result (the coordination experiment)

| Metric | Result |
|---|---|
| Agents completed | **10/10, zero failures, zero retries** |
| Per-agent wall-clock | 43–76s |
| Batch wall-clock | ~7 min (launch → last artifact) |
| Tokens | ~44–51K per agent, ≈463K total (Haiku rate) |
| Rally facts | 20 (10 claims + 10 artifacts), all landed |
| `rally dag --run haiku-scale-20260609-01` | Reconstructs all 10 nodes, status `landed` |
| `before-write --strict` | 10/10 allowed (disjoint owns held) |
| Ledger contention | None observed at 10 concurrent writers |

Verdict: **rally-workflows coordination holds at 10 concurrent Haiku agents.** GO for a
20-agent wave; for ~100, run waves of ~15–20 (host subagent concurrency, not rally, is
the binding constraint).

## Severity tally (59 findings)

critical 7 · high 24 · medium 24 · low 4

## Converged themes (independent agreement across lenses)

### 1. Evidence provenance is the #1 effectiveness gap — 8/10 personas, 5 critical findings
Every business lens (ops, design, support, CI, PMM, field) independently flagged that
persona claims aren't traceable to sources. Strongest asks:
- Make `evidence_item.source_uri` **required** for real-source types (interview, survey,
  support, sales, analytics) and render it in `PersonaDetail` as drill-down (p01, p03, p10).
- **Claim→evidence linking**: goals/frustrations/scenarios should carry optional
  `evidence_ids` so each claim cites its support (p02, p04).
- Real **quotes/samples**, not summaries — support wants actual ticket snippets; field
  wants per-opportunity disaggregation with `coverage_count` (p03, p06).

### 2. Synthetic-evidence disclosure and weighting — 5/10 personas
- Add `behavior_source: real_users|synthesized|expert_opinion|mixed` +
  `is_synthetic_disclosed` to evidence items (p08).
- Distinct visual treatment for synthetic evidence (structured warning, not a subtle badge) (p02).
- Auto-downgrade personas with ≥50% synthetic evidence to **draft** status (p01).
- Split `confidence` into `evidence_confidence` vs `synthesis_confidence`; compute a
  per-source `confidence_breakdown` (p02, p10).

### 3. Domain-grade evidence metadata for GTM lenses — p04/p05/p06
Competitor names, deal stage, buyer segment, objection taxonomy, `approved_language`
response templates. Without these, CI/PMM/field personas read as "abstract archetypes"
(Dee Carter's anti-pattern, now confirmed by three other lenses).

### 4. Workspace accessibility — p07 (1 critical)
Focus states rely on low-opacity ring only; errors are color-only with no
`aria-live`/icon; form hints not linked via `aria-describedby`. Concrete Tailwind +
ARIA fixes specified in p07-asha-patel.json.

### 5. Novice onboarding — p09
PersonaForm supports only single evidence entry with no in-form explanation of the
synthetic/real distinction; a first-week PM would create low-trust personas without
knowing it.

### 6. Measurement discipline — p10
Pre-register a `<council-id>-measurement-plan.json` (council composition, predicted
outcomes, success criteria) **before** convening councils, then track predictive
validity against real-user findings — the only way to know personas are getting more
effective rather than just more elaborate.

## Top 5 recommended changes (synthesis, ranked by cross-persona weight)

1. Schema: require `source_uri` for real-source evidence types; add `behavior_source` +
   `is_synthetic_disclosed`; add optional `evidence_ids` on goals/frustrations/scenarios.
2. UI: provenance drill-down in PersonaDetail (evidence table: title, source_type,
   confidence, link); structured synthetic-evidence warning treatment.
3. Trust mechanics: auto-draft personas ≥50% synthetic; split confidence into
   evidence vs synthesis components with per-source breakdown.
4. A11y: p07's focus/ARIA/error-state fixes on PersonaForm/Card/List.
5. Process: p10's pre-registered measurement plan per council + predictive-validity log.

## Provenance

Per-persona detail: `p01`–`p10` JSONs in this directory. Descriptor: `workstream.json`
(linted exit 0). Lineage: `rally dag --run haiku-scale-20260609-01` from the repo root.
Personas p01–p06 from `src/lib/fixtures.ts`; p07–p10 synthesized for lens coverage
(accessibility, privacy/compliance, novice, research methodology) per persona-lab
selection rules.
