# Persona Selection Reference

## Default Critique Lenses

Lead with these six research-backed lenses. Pick 4 to 6 by task-relevant coverage of
goals, jobs-to-be-done, and risk, not by demographics. Fewer, sharply distinct
lenses beat many overlapping ones.

1. Novice / first-run user: comprehension, initial value, onboarding, first
   task completion.
2. Power user / expert: speed, density, shortcuts, repeat workflows, ceiling.
3. Skeptic / adversary / red-team: trust, failure modes, abandonment triggers,
   what breaks or misleads. REQUIRED in every panel.
4. Accessibility / constraint-bound user: keyboard flow, semantics, contrast,
   cognitive load, inclusive language, low-bandwidth or degraded conditions.
5. Decision-maker / buyer: outcome fit, proof needs, procurement, ROI,
   objections.
6. Domain specialist: correctness, safety, and conventions of the specialized
   market the product serves.

The red-team lens is the structural counter to LLM positivity bias. Never omit
it. Add a domain specialist when the product serves a specialized market.

## Role Catalog

Product and business:

- Product manager: roadmap fit, activation, retention, prioritization.
- General manager: market fit, revenue, strategic risk, operational scale.
- Growth lead: acquisition, conversion, onboarding, referral loops.
- Sales leader: buyer objections, enterprise readiness, proof needs.
- Customer success manager: adoption, support burden, rollout friction.

Design and research:

- UX designer: interaction model, hierarchy, flow, affordances.
- UX researcher: task framing, research validity, user evidence gaps.
- Content designer: clarity, labels, error text, narrative flow.
- Accessibility reviewer: keyboard, screen reader, contrast, cognitive load.

Technical:

- Frontend engineer: component state, responsiveness, performance, errors.
- Platform engineer: reliability, integration, deployment, observability.
- Data analyst: instrumentation, metrics, segmentation, decision quality.
- Security or privacy reviewer: data exposure, access control, compliance.

User and operator:

- New user: onboarding, comprehension, initial value.
- Power user: speed, shortcuts, density, repeat workflows.
- Skeptical user: trust, motivation, switching cost, abandonment triggers.
- Operator or admin: permissions, auditability, bulk workflows, failure recovery.
- Support agent: explainability, troubleshooting, docs, handoff burden.

Domain-specific:

- Healthcare operator: safety, privacy, regulation, clinical workflow.
- Finance operator: auditability, risk controls, compliance, trust.
- Education leader: learning outcomes, accessibility, classroom operations.
- Developer platform user: docs, API clarity, errors, local setup.
- Enterprise buyer: security review, procurement, admin controls, ROI.

## Independence And Anti-Sycophancy

These rules make the panel worth running. Skip them and personas converge to one
agreeable voice that invents findings.

- Require a red-team lens. Every panel includes at least one adversarial /
  red-team perspective. Sycophancy and positivity bias are the dominant LLM
  failure mode; the red-team lens is the structural counter.
- Instruct anti-goals. Each persona states what would make this user abandon,
  distrust, or reject the product, not only what would delight them.
- Allow abstention over fabrication. LLMs fabricate roughly half the time
  instead of saying "I don't know". A persona that cannot judge a point must
  answer "cannot judge from available evidence" or "no concern", never invent a
  finding.
- Engineer independence. Distinct personas collapse into a homogeneous mode when
  they share context or a status hierarchy. Run each persona's critique in a
  separate context with no shared transcript, and synthesize only after all
  independent passes complete.
- Preserve conflicts. Synthesis keeps opposing findings as explicit tradeoffs,
  for example power user wants density versus novice wants simplicity. Never
  average dissent away; keep dissenting critical findings.
- Label provenance. Every persona and every finding carries whether it is
  grounded in real evidence or is a model assumption. Ungrounded output is
  labeled an assumption. The panel is a hypothesis, not validation.

## Current Research Triggers

Use internet research when the request depends on any of these:

- Current company roles, product lines, or strategy.
- Competitor comparison.
- Market sizing, pricing, trends, or buyer behavior.
- Laws, regulations, standards, or compliance expectations.
- Security threat patterns.
- Publicly available user sentiment or reviews.
- Platform or framework behavior that may have changed.

If research is needed but unavailable, state that the role selection or market
context is unverified.

## Selection Heuristics

- For `review this UI`: UX designer, skeptical target user, accessibility
  reviewer, product manager, frontend engineer.
- For `enterprise workflow`: enterprise buyer, admin/operator, security
  reviewer, customer success manager, product manager.
- For `growth or landing page`: growth lead, skeptical prospect, sales leader,
  content designer, product manager.
- For `dashboard or analytics`: data analyst, operator, product manager,
  skeptical user, accessibility reviewer.
- For `API or developer tool`: developer platform user, platform engineer,
  technical writer/content designer, security reviewer, product manager.
- For `regulated domain`: domain expert, risk/compliance reviewer, operator,
  product manager, skeptical target user.

## Professional archetypes and specialties

Use `persona archetypes` to browse broad professional roles and `persona consult "<task>" --json` to select task-specific expertise. Roles and specialties may overlap. Compose paths such as `product-marketing/hardware/networking` or combine independent paths such as `venture-capital,vertical-saas/healthcare`. These paths describe requested expertise; attached source principles determine evidence coverage. See `docs/archetypes.md`.
