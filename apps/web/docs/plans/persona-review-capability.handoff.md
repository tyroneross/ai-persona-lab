# Handoff: Persona Review Capability

## Bottom Line

Implement the native council workflow first: contracts, local repositories,
coordination UI, deterministic planner adapter, findings/synthesis, then prompt
and package comparison lanes. Do not start with a generic Agent Builder model.

Read this before implementation:

- `docs/persona-review-operating-model.md`
- `docs/plans/persona-review-capability.md`
- `docs/architecture.md`
- `docs/data-contracts.md`
- `plugins/persona-lab/README.md`
- `plugins/persona-lab/scripts/persona-plan.mjs`
- `councils/runs/haiku-scale-20260609-01/PANEL-REPORT.md`

## Implementation Pointers

When implementing F-01, read ADR-01 and satisfy T-01/T-02. Keep council types in
`src/lib/council.ts`; do not widen the current `Persona` contract to carry all
council state.

When implementing F-02, read ADR-01 and satisfy T-02/T-03. Use repository
interfaces and local JSON behind the boundary. Mutating writes need optimistic
`updated_at` checks and local `RunEvent` entries.

When implementing F-03, read ADR-02 and satisfy T-04/T-05. Add `/councils`,
`/councils/new`, and `/councils/[runId]`. Synthetic status and evidence gaps must
be visible as warning blocks, not hidden badges.

When implementing F-04, satisfy T-06. The persona-plan adapter must not shell
out from client components. Treat generated output as a draft that a user can
edit before launch.

When implementing F-05, read ADR-03 and satisfy T-07. Generate local/Rally
command packets first. Do not auto-launch agents from the browser in P0/P1.

When implementing F-06, read ADR-04 and satisfy T-08. Prompt Builder metadata is
optional quality evidence: prompt family, version, model tier, scores, and
comparison notes. It does not prove the findings are true.

When implementing F-07, read ADR-05 and satisfy T-09. Agent Builder-style export
is an artifact under `exports/councils/`; it is not the app's source of truth.

## File Ownership

Codex-owned architecture/data scope:

- `src/lib/council.ts`
- `src/lib/council-repository.ts`
- `src/lib/council-repository.server.ts`
- `src/lib/persona-plan-adapter.ts`
- `schemas/*.schema.json`
- `data/*.json`
- `docs/plans/*.md`

Claude/UI-owned scope by project convention:

- `app/councils/**`
- `components/*Council*.tsx`
- `components/*Finding*.tsx`
- `components/*Synthesis*.tsx`
- `components/AppShell.tsx`
- `styles/**`

Coordinate through Rally before crossing ownership boundaries.

## Validation Gates

Run after code slices:

```bash
npm run typecheck
npm run build
git diff --check
```

Add focused tests when the repository layer lands:

```bash
node --test
```

Smoke the deterministic planner path:

```bash
node plugins/persona-lab/scripts/persona-plan.mjs "Review the councils workflow at medium depth"
```

After UI implementation, use browser verification for:

- `/councils`
- `/councils/new`
- `/councils/[runId]`

Check desktop and mobile widths, especially warning blocks, command packet text,
assignment tables, and measurement-plan forms.
