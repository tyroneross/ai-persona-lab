# Persona Lab

> **Read [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md) before relying on any of
> this.** The docs are written declaratively so the method stays consistent, but
> nearly all of it rests on one six-persona study, zero real runs have been
> recorded through the current tooling, and nothing has been calibrated against
> real human reactions. The enforcement is this project's opinion held steady —
> not evidence that the opinion is right.

Persona Lab turns a request into a focused AI persona panel, and keeps the
personas it generates in a recallable, global library. It ships three entry
points over one engine:

- **CLI** (`persona`) — generate, save, recall, and plan panels from any repo.
- **Plugin** (Claude Code + Codex) — a skill, command, and agents so coding
  agents can run persona reviews.
- **App** — the `AI User Personas` Next.js UI reads and writes the same library.

It codifies this workflow:

1. Capture the request.
2. Recall an existing roster/personas, or select fresh perspectives.
3. Generate personas (one distinct lens each), grounded in real evidence where
   available and labelled as hypothesis where not.
4. Run independent persona reviews, then synthesize while preserving conflicts.
5. Save reusable personas and rosters for next time.

Output is a **hypothesis for review, not validated user research**. Every panel
requires at least one adversarial (red-team) lens, runs each persona
independently to avoid groupthink, and lets personas abstain rather than
fabricate.

## Quick Start

**As a Claude Code or Codex plugin**, type `/persona-lab:persona-review` and describe what you want
reviewed. That is the entry point: it selects the lenses, recalls or generates the personas, runs
each pass independently, and reports back. `/persona-lab:run` drives an existing council run in the
AI User Personas app, and `/persona-lab:submit-feedback` files a bug or feature request.

**As a CLI**, install it below.

## Install the CLI

From this plugin directory:

```bash
npm link          # exposes `persona` on your PATH
# or: npm install -g .
```

The library lives at `~/.persona-lab/` by default (override with
`PERSONA_LAB_HOME`). It is global: save a persona once, recall it from any repo.

```text
~/.persona-lab/
  personas.json               { schema_version, personas[] }
  rosters/<slug>.json          named lens/persona presets for a use-case
  encounters/<persona_id>/*.json   what each persona has seen, append-only
  runs/<run_id>/{run.json,report.md}  what happened in each panel
```

## CLI

```bash
persona new "review the onboarding flow for enterprise admins" --count 4
#   selects distinct lenses (>=1 adversarial), emits fill-in scaffolds + a
#   generation prompt + a measurement plan. Add --json for the scaffolds.

persona save persona.json          # validate + persist to the library
persona validate persona.json      # schema check only (exit 1 on failure)

persona list [--tag t] [--role r] [--status s]
persona show <id>
persona search "audit"
persona archive <id>   |   persona rm <id>

persona roster save "Enterprise rollout review" \
  --lenses red-team,buyer,accessibility,novice \
  --personas persona_dana-okoro_57144a1d \
  --use-case "Reviewing a B2B feature before enterprise rollout"
persona roster list | show <name> | rm <name> | lenses

persona panel "review the settings redesign" --level medium
persona panel --roster "Enterprise rollout review" --level high

persona home        # print the library path

# judge the panel after the fact, and reuse what worked
persona run lesson <run_id> --verdict valuable --changed "..." --worked "a;b"
persona run proven                 persona roster from-run <run_id> --name "..."

# what a persona may bring with it (scoped by its role, not your mood)
persona recall <persona_id> [--artifact <slug>] [--project <name>]

# a panel as a durable object you can open months later
persona run new "<question>" --artifact <slug> --version <v> --personas id1,id2
persona run list | show <run_id> | report <run_id> | close <run_id> [--synthesis <file|->]

# what a persona has SEEN — written by the persona before it returns
persona encounter new <persona_id> --artifact <slug> --label ".." --version ".."
persona encounter save <file|->   |  validate <file|->
persona encounter list [<persona_id>] [--artifact <slug>]  |  show <encounter_id>
```

### Encounter memory

`personas.json` holds who a persona is. Encounters hold what it has *seen*. A
persona held in a running agent has a memory measured in seconds — a subagent
becomes eviction-eligible about thirty seconds after it finishes — so continuity
lives in files and a running agent is only a temporary reader of them.

`verbatim` is authoritative and never summarised; `findings` are a lossy
extraction kept beside it. `kind` separates a defect from a preference,
`verified` allows `reclassified` (a reported defect is often a silent gate),
`unanswered` carries what a session could not settle into the next dispatch, and
`conditions.viewports` is required. Encounters are append-only.

Contract: `docs/persona-memory.md`. Method assessment behind it:
`docs/persona-method-assessment.html`.

The CLI is the deterministic substrate: it owns the library, schema validation,
lens selection, and review planning. Generating persona *content* and running
the review are done by the LLM host (a coding agent, the skill, or Codex), which
calls the CLI to persist and recall. No API key is needed by the CLI.

### Review levels

- `low` — 3-4 lenses, single independent pass. Cheap first look.
- `medium` — 4-6 lenses incl. required red-team, independent passes + synthesis.
- `high` — 6+ lenses, independent passes + adversarial verification of critical
  findings + measurement rigor.

## Plugin (Claude Code and Codex)

The plugin content is host-neutral; both hosts load the same command, agents,
skill, references, and CLI.

```bash
claude --plugin-dir ./plugins/persona-lab
codex  --plugin-dir ./plugins/persona-lab
```

Slash command:

```text
/persona-lab:persona-review Review the onboarding flow for a founder persona.
```

## Structure

```text
persona-lab/
  package.json                     bin: persona -> bin/persona.mjs
  bin/persona.mjs                  CLI
  lib/library.mjs                  global library (personas + rosters) + validation
  lib/roles.mjs                    lens catalog + selection (>=1 adversarial)
  lib/encounters.mjs               encounter store + validation (global library)
  lib/runs.mjs                     panel runs + generated reports
  lib/recall.mjs                   lifespan + recall scope: what a persona brings
  schemas/persona.schema.json      who a persona is
  schemas/encounter.schema.json    what a persona has seen
  schemas/run.schema.json          what happened in a panel
  commands/persona-review.md
  agents/persona-panel-orchestrator.md
  agents/persona-perspective-reviewer.md
  agents/persona-research-adjudicator.md
  skills/persona-lab/SKILL.md
  skills/persona-lab/references/persona-selection.md
  scripts/persona-plan.mjs         legacy first-pass planner (superseded by `persona new`)
```

## Schemas

Canonical contracts: `schemas/persona.schema.json` (v1.1.0) for identity,
`schemas/encounter.schema.json` (v1.0.0) for what a persona has seen. Load-bearing
fields are goals, behaviors, frustrations, motivations, needs, and
`job_to_be_done`; demographics are optional decoration. `provenance`
(`proto | qualitative | synthetic-grounded | synthetic-assumed`) and `anti_goals`
make the persona's basis and abandonment triggers explicit.

## About

Persona Lab is built by [RossLabs](https://rosslabs.ai). The npm package is
published as `@tyroneross/persona-lab`, on the same scope as the rest of the
family; RossLabs is the org behind it if you want the background.
