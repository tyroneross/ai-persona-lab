# AI User Personas Architecture

## Bottom Line

Build the first version as a local-first persona workspace with a stable persona
contract, a thin repository boundary, and local JSON persistence for both base
personas and council-review screens.

The core architecture decision is to separate the persona domain from the UI:
Claude can build list/detail/editor screens against the schema now, while Codex
keeps the data model, validation rules, persistence boundary, and future
generation pipeline explicit.

The persona-review council capability now sits beside the base persona
workspace. It owns repo rosters, review runs, measurement plans, assignments,
findings, synthesis, prompt comparisons, and Agent Builder-style export
packages through `src/lib/council.ts` and the council repository boundary.

## V1 Scope

In scope:

- Create, view, edit, archive, and export AI user personas.
- Preserve evidence and source provenance for every persona.
- Support UI filtering by status, tags, role, confidence, and source type.
- Keep the app usable without a backend by starting with a repository adapter.
- Leave room for later AI-assisted persona generation without blocking the UI.
- Plan low, medium, and high-depth persona review councils.
- Persist council rosters and review runs in local JSON files.
- Show evidence gaps, synthetic disclosure, confidence, and status in the
  `/councils` UI.
- Export council runs as markdown and Agent Builder-style JSON packages.

Out of scope for the first pass:

- Multi-user collaboration.
- Accounts, auth, billing, or cloud sync.
- Fully automated persona generation without human review.
- External CRM, analytics, or research-repository integrations.

## System Shape

```text
UI shell
  -> PersonaRepository interface
    -> File-backed local JSON adapter
  -> CouncilRepository interface
    -> File-backed council roster/run adapter
    -> Deterministic persona-plan adapter
    -> Command-packet and export adapters
  -> Persona domain validation
    -> schemas/persona.schema.json
  -> Council domain validation
    -> schemas/persona-roster.schema.json
    -> schemas/persona-review-run.schema.json
  -> Future generation pipeline
    -> raw inputs -> evidence items -> persona draft -> reviewed persona
```

## Ownership Boundaries

Claude-owned UI paths should consume the data contract without redefining the
domain model:

- Persona list and filtering.
- Persona detail view.
- Persona editor/intake form.
- Empty, loading, error, and validation states.
- Visual hierarchy and component interaction model.

Codex-owned architecture/data paths define:

- Persona schema and validation rules.
- API and repository contracts.
- Persistence and import/export boundaries.
- Data flow from source evidence to reviewed persona.
- Handoffs for UI requirements that need frontend implementation.

## Domain Model

The app centers on one canonical entity: `Persona`.

A persona represents a researched or synthesized user archetype. It must include:

- Human-readable identity: name, archetype, summary, role, and tags.
- Behavioral model: goals, frustrations, motivations, behaviors, needs, and
  scenarios.
- Evidence model: source references, confidence, and provenance notes.
- Lifecycle state: draft, active, or archived.
- Timestamps and schema version for migrations.

The canonical JSON Schema lives at
`schemas/persona.schema.json`.

## Data Flow

1. User enters or imports source material.
2. Input is normalized into evidence items with source metadata.
3. The app creates a persona draft manually or through a future AI-generation
   step.
4. A human edits and approves the draft.
5. The repository stores the persona as the canonical JSON shape.
6. The UI renders list, detail, compare, and export views from that shape.

## Repository Boundary

Use a small repository interface rather than binding the UI directly to storage.

```ts
type PersonaRepository = {
  listPersonas(filters?: PersonaFilters): Promise<PersonaSummary[]>;
  getPersona(id: PersonaId): Promise<Persona | null>;
  createPersona(input: PersonaCreateInput): Promise<Persona>;
  updatePersona(id: PersonaId, input: PersonaUpdateInput): Promise<Persona>;
  archivePersona(id: PersonaId): Promise<Persona>;
  exportPersonas(ids?: PersonaId[]): Promise<PersonaExport>;
};
```

Implementation by surface:

- Base persona app: file-backed JSON adapter behind `/api/personas`.
- Council workflow: file-backed JSON adapter behind server actions and
  `/councils` routes.

The UI should not care which adapter is active.

Council reviews use the same boundary rule. `CouncilRepository` owns roster,
run, measurement-plan, assignment, finding, synthesis, prompt-version,
outcome-comparison, and event records. The file-backed server adapter reads
`data/council-rosters.json` and `data/council-runs.json`, validates writes,
writes via a temporary file and rename, and rejects stale status transitions
when the loaded `updated_at` timestamp no longer matches. Empty council JSON
files produce empty council screens; the app does not import sample rosters or
runs as live state.

## V1 Implementation Decisions

Approved UI stack:

- Next.js 16 App Router.
- TypeScript.
- Tailwind for styling.
- React state and server actions before adding a state library.

Approved V1 storage:

- Use local file-backed JSON behind the repository boundary.
- Store canonical persona records in `data/personas.json`.
- Store council records in `data/council-rosters.json` and
  `data/council-runs.json`.
- Do not seed base persona records from fixtures. An `active` persona should be
  a saved app record.
- Do not seed council rosters or runs from fixtures. Historical council
  artifacts can remain in `councils/` for audit context, but they are not live
  app state unless explicitly imported.
- Defer SQLite, Drizzle, Neon, and external databases until the local JSON
  adapter becomes a real constraint.

Approved ID strategy:

- Persona id format: `persona_<slug>_<8hex>`.
- Evidence id format: `evidence_<slug>_<8hex>`.
- The slug should come from the human-readable name or evidence title.
- The hex suffix should be generated when the record is created and should not
  change when display fields are edited.

## API Boundary

If the app uses HTTP endpoints, keep them narrow:

- `GET /api/personas`
- `POST /api/personas`
- `GET /api/personas/:id`
- `PUT /api/personas/:id`
- `DELETE /api/personas/:id`
- `POST /api/personas/export`

`DELETE` should archive by default in V1. Hard delete can be deferred.

## State Flow

Recommended frontend state:

- Server/repository state: persona list and detail payloads.
- Form state: unsaved persona edits.
- View state: selected persona id, filters, sort, active tab, compare selection.
- Validation state: field-level schema errors and save-blocking errors.

Avoid duplicating complete persona objects across unrelated stores. Keep one
loaded detail record and lightweight summaries for lists.

## Error And Validation Rules

Save should be blocked when:

- `name`, `archetype`, `summary`, `primary_goal`, or `evidence` is missing.
- Confidence is outside `0..1`.
- Required arrays are empty.
- A source reference lacks `source_type` or `summary`.
- The record does not match `schemas/persona.schema.json`.

UI should surface validation near the field that caused it and preserve unsaved
input after a failed save.

## UI Handoff Requirements

Claude should build the first UI shell around these contract-backed screens:

- Persona dashboard: searchable list with status, confidence, tags, and primary
  goal visible.
- Persona detail: overview, goals, frustrations, motivations, scenarios,
  evidence, and notes.
- Persona editor: required fields, repeatable list controls, confidence input,
  evidence/source fields, save/archive actions, and validation states.
- Empty state: prompt to create or import the first persona.
- Error state: readable repository/validation error with retry where relevant.

The base persona UI must use the persona repository and local JSON file so
create/edit/archive actions persist. Fixture personas are not user-facing app
state. The same rule applies to councils: roster and run screens should reflect
only `data/council-rosters.json` and `data/council-runs.json`.

## Open Decisions

- AI generation should remain behind a draft/review boundary. No generated
  persona should become active without human acceptance.
- Cloud deployment needs a durable storage adapter before production use. Local
  JSON is appropriate for local dogfooding and persistent-filesystem hosts, not
  serverless or immutable deployments.
