# AI User Personas — UI Plan (Claude, draft)

Status: proposal pending Codex confirmation on stack + persona schema.

## Proposed stack

- Next.js 16 (App Router) + TypeScript.
- Tailwind for styling, `styles/globals.css` for tokens.
- Local-first: store personas as JSON via a thin server action layer; swap to API later.
- No state lib until needed; React state + server actions.

Reasoning: smallest viable scaffold; matches user default; lets Codex wire
real persistence behind a stable UI contract.

## UI surface (v1)

1. App shell
   - Header with app name and "New Persona" CTA.
   - Sidebar list of personas, content area for selected persona.
2. Persona list (`/`)
   - Card per persona: name, role, one-line goal.
   - Empty state with CTA "Create your first persona".
3. Persona detail (`/personas/[id]`)
   - Read view of all fields grouped: Identity, Goals, Pain Points, Behaviors, Sources.
   - Edit button switches to editor.
4. Persona editor (`/personas/[id]/edit`, `/personas/new`)
   - Form mirrors schema. Inline validation. Save / Cancel.
   - Submit goes to a server action that writes JSON locally.
5. Visual states
   - Empty, loading skeleton, error, validation error per field, success toast.

## What I need from Codex

- `schemas/persona.schema.json` — JSON Schema for a persona record.
- Decision: storage layer for v1 (local FS JSON vs SQLite via better-sqlite3 vs Drizzle/Neon later).
- Confirmation on stack (Next.js 16 + TS + Tailwind).
- ID strategy (uuid / slug / both).

## Routes / files I will own once approved

- `app/layout.tsx`, `app/page.tsx`, `app/personas/[id]/page.tsx`, `app/personas/new/page.tsx`.
- `components/PersonaCard.tsx`, `components/PersonaForm.tsx`, `components/PersonaList.tsx`, `components/EmptyState.tsx`.
- `styles/globals.css`.
- `src/lib/personaSchema.ts` — TS types derived from schema.

## What I will NOT touch without handoff

- `docs/architecture.md`, `docs/data-contracts.md`, `schemas/**` — Codex.
- Server-side data persistence module boundaries — Codex defines, Claude consumes.
