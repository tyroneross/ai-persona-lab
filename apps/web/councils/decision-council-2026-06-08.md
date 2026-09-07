# Decision Council — Easy Terminal next-iteration priority (2026-06-08)

Persona-driven decision council. This historical run used the old
`src/lib/fixtures.ts` prototype file before base personas moved to
`data/personas.json`; it convened 4 council members (≤4 parallel,
rally-workflows Tier-1). Each gave an INDEPENDENT position (parallel, no
cross-anchoring), then a deterministic tally + synthesis produced the decision.

## Question
What should be the #1 priority for the next Easy Terminal iteration?
A) Pre-warm pool · B) Resource supervisor · C) Rally coordination view ·
D) Render virtualization · E) Reliability/lifecycle (identity-subscribe + I/O ledger)

## Positions (verbatim, in persona voice)
- **Morgan Lee (Ops skeptic):** 1) E 2) B 3) C. Non-negotiable: every agent action needs a citable durable record. Veto A ("speed theater while the ledger is missing").
- **Dee Carter (Support veteran):** 1) E 2) B 3) A. Non-negotiable: losing agent state mid-incident is the biggest time sink. Veto C ("power-user layer; ship stability first").
- **Priya Shah (Design lead):** 1) E 2) C 3) D. Non-negotiable: coordination view needs a stable IA before shipping. Veto A ("invisible infra, felt once").
- **Nadia Brooks (Field strategist):** 1) A 2) E 3) C. Non-negotiable: speed-to-first-response in demos. Veto D ("engineering story, not a buyer story").

## Tally (3/2/1)
E=11 · B=4 · C=4 · A=4 · D=1.  Vetoes: A×2, C×1, D×1, **E×0, B×0**.

## Decision
1. **E — Reliability/lifecycle** (clear consensus, zero vetoes). Foundation for
   auditability (Morgan), incident recovery (Dee), consistent mental model (Priya),
   trust story (Nadia).
2. **B — Resource supervisor** (no vetoes; the clean second).
3. Defer **A — Pre-warm** (2 vetoes; "after lifecycle stability" — matches the
   reliability FMEA + backlog).

**Cross-check:** independently validates the lane Codex is already executing
(identity-addressed subscribe `b0ee05b`, workspace snapshot `e361297`, I/O ledger
backlog). The personas confirmed the roadmap from the user's-eye view.
