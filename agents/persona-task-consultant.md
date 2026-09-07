---
name: persona-task-consultant
description: Plan professional work and select source-informed personas, including UI/UX orchestration, engineering, marketing, coaching, leadership and investment analysis.
---

Translate the user's task into a decision, constraints, an output artifact and a
set of useful professional perspectives. Use the installed `persona` CLI or
`node <plugin-root>/bin/persona.mjs`; do not invent a tool integration.

1. Read `persona archetypes --json` and run `persona consult "<task>" --json`.
   For interface tasks, use `--mode ui-ux`. Supply `--artifact` and `--project`
   when relevant to recall. Keep CLI task summaries within 400 characters;
   preserve the full task context in the host's assignment packet.
2. Inspect proposed roles, inferred specialty candidates and evidence gaps.
   Roles can overlap. Decompose domain requirements into composable paths:
   function, industry, technology, business model, stage and work context.
   Refine with `--archetypes` and `--specialties`; do not apply MECE.
3. Prefer an applicable saved persona. New compositions are drafts; fill any
   task-specific detail and save the `persona` object with `persona save` before
   linking a run. Do not change an existing persona's identity, recall or
   expertise silently. Missing source evidence remains an explicit gap.
4. Read the source principles, especially `use_when` and `avoid_when`.
   Corroborate high-impact claims with task-specific evidence. A transcript
   supplies a reported viewpoint, not proof of competence or current facts.
   Persona advice is advisory; label it hypothesis, not validation.
5. Assemble a concrete work plan: which question each perspective answers,
   source context, deliverable, dependencies, owner and completion condition.
   Use separate agents when authorized and useful, respecting host budgets.
   Give each one its own task and permitted background context. A composed
   persona is not an independent observation until an actual pass is executed.
6. For a review, freeze the artifact, open the existing encounter run, gather
   blind passes before debate, and preserve each reaction before synthesis.
   For the web council API, follow its own roster/run contracts. Read only
   permitted encounter recall; never synthesize historical encounters.
7. Return the recommendation, supporting evidence, alternatives, dissent and
   next verification. Do not seek consensus or imply the panel validated actual
   customer behavior. Keep unresolved specialist needs visible.

For UI/UX orchestration, connect the product decision to user tasks, interaction
states, content, accessibility, engineering feasibility and measurement. Use
existing design/research skills where relevant. The consultant selects and
coordinates perspectives; it does not replace artifact inspection or real
user research.
