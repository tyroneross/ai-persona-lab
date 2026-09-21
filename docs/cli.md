# CLI reference

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

# who runs this panel, and what it must settle before choosing a persona
persona orchestrate "redesign the onboarding screen" --json
persona orchestrate "should we raise prices to defend the moat" --lane strategy
persona orchestrate lanes                  # every lane, its triggers and its agent
#   Resolves the accountable orchestrator (ui-ux-design, product, strategy,
#   engineering, marketing, general), emits the outcome frame to answer BEFORE
#   selecting personas, the persona plan, the reviewed sources worth consulting,
#   and who consumes each recommendation. Plan-only; no model calls.

# the reviewed-source guest registry
persona guests --category positioning-and-marketing
persona guests --assists retention --json
persona compose engineer --guest will-larson    # restrict a seat to one speaker
persona list --assists positioning              # saved personas by area

# turn a closed panel into addressed work
persona run recommend <run_id> <packet.json|-> [--validate-only] [--json]
persona run recommendations <run_id> [--json]
#   Append-only. Every recommendation names one consumer and one acceptance
#   check. A closed run still accepts a packet; an abandoned one does not.

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

### Orchestrators

`persona orchestrate` selects the lane, states the outcome frame the orchestrator
answers before any persona is chosen, and names who executes each recommendation.
Lane resolution is deterministic: highest keyword score wins, ties break on registry
order, `--lane` overrides, and a task matching nothing falls back to `general` rather
than guessing. The runner-up lane is reported so a near-tie stays visible.

The recommendation packet (`schemas/recommendation-packet.schema.json`) requires a
named consumer and an observable acceptance check per item, refuses to mark a refuted
finding as accepted work, refuses to let an assumption claim `source-confirmed`, and
refuses a version the run never judged.

Full reference: `docs/orchestrators.md`. The shared eleven-step protocol every
orchestrator runs: `skills/persona-lab/references/orchestrator-protocol.md`.

### Encounter memory

`personas.json` holds who a persona is. Encounters hold what it has *seen*. Save encounters before a reviewer returns so the review record survives the
agent session.

`verbatim` is authoritative and never summarised; `findings` are a lossy
extraction kept beside it. `kind` separates a defect from a preference,
`verified` allows `reclassified` (a reported defect is often a silent gate),
`unanswered` carries what a session could not settle into the next dispatch, and
`conditions.viewports` is required. Encounters are append-only.

Contract: [persona memory](persona-memory.md).

The CLI is the deterministic substrate: it owns the library, schema validation,
lens selection, and review planning. Generating persona *content* and running
the review are done by the LLM host (a coding agent, the skill, or Codex), which
calls the CLI to persist and recall. No API key is needed by the CLI.

### Review levels

- `low` — 3-4 lenses, single independent pass. Cheap first look.
- `medium` — 4-6 lenses incl. required red-team, independent passes + synthesis.
- `high` — 6–8 lenses, independent passes + adversarial verification of critical
  findings + measurement rigor.


## Freeze a source review and save its evidence

These commands prepare durable source reviews without calling a model. The web Council API retains its separate run contract.

```sh
persona artifact freeze --root /absolute/repo --files src/card.ts,docs/product.md --output /absolute/new-snapshot
persona artifact verify /absolute/new-snapshot/manifest.json
persona run new "Check positioning and source accuracy" --artifact product --version review-v1 --personas persona_saved --manifest /absolute/new-snapshot/manifest.json
persona run packet RUN_ID persona_saved --owns src/card.ts,docs/product.md --budget-minutes 10
```

Use canonical filesystem paths and a new destination outside the source root. The explicit file list preserves relative directories, records source Git commit and dirty-status identity when available, and hashes copied bytes. Symlinks, traversal, nonregular inputs, and output collisions are refused. The snapshot is not a signature or secret scanner. After moving it, update `snapshot_root` in both the stored manifest and the run manifest; verification reports missing or changed evidence rather than silently trusting a version name.

`run new` without `--manifest` remains compatible, labeled a declared freeze. `run packet` requires a verified byte snapshot. Its JSON contains a saved profile and hash, packet hash, explicit scope, one-pass budget, source-only conditions and an encounter template. Replace the template reaction with the actual reaction; findings and decisions begin empty. A decision is an object with `action` and `rationale`. The host executes the saved packet; when using Rally, use the packet as the task payload. Keep other reviews out of a blind review's context.

## Run a visual comprehension journey

Use a study file when the question is whether a new visitor can navigate the rendered product and explain what it taught them. This is separate from the source-only packet above.

```sh
persona run new "Can a new visitor learn RAG and assess the product?" \
  --artifact product-site --url https://example.test --version production-2026-09-21 \
  --personas persona_one,persona_two --study study.json
persona run journey RUN_ID persona_one --viewports 390x844 --tools computer-use,screenshot --budget-minutes 10
```

The journey directory contains `USER.md`, `SOUL.md`, `GOAL.md`, `CAPABILITIES.md`, `packet.json`, `encounter.json`, and assessor-only `ASSESSOR.json`. The persona-visible files define identity, behavior, goal, executable capability preflight, tasks, snapshot checkpoints, and teach-back questions. Expected concepts and scoring rubrics exist only in `ASSESSOR.json`. The host must attach and exercise real navigation, interaction, interface inspection, viewport, and snapshot capabilities; a declared tool name or Persona Lab UI is not proof. The persona must stop browsing before answering, but this is procedural closed-book: an LLM still retains prior context, so the result tests synthesis rather than human memory.

Record dispatch after the host supplies a child ID and prompt hash:

```json
{
  "run_id": "RUN_ID",
  "persona_id": "persona_saved",
  "artifact_version": "review-v1",
  "child_id": "actual-host-child-id",
  "context_mode": "fresh",
  "prompt_sha256": "SHA256_OF_ACTUAL_HOST_PROMPT",
  "profile_sha256": "SHA256_FROM_PACKET",
  "packet_sha256": "SHA256_FROM_PACKET",
  "prior_encounters_shown": [],
  "started_at": null,
  "ended_at": null,
  "model": null,
  "usage": null,
  "provenance": "orchestrator-declared",
  "activity": "review"
}
```

Run `persona run dispatch receipt.json`. Replace digest placeholders with actual 64-character hexadecimal SHA256 values. Optional `encounter_id` links a completed review; append a second receipt with `correction_of` to update the earlier receipt. Activities are `review`, `source-verification`, and `integration`. `host-receipt` provenance requires `evidence_locator`; it records a claimed source, not cryptographic host authentication. Usage accepts nonnegative `input_tokens`, `output_tokens`, `total_tokens`, `cached_input_tokens`, `cost_usd`, and `latency_ms`; unknowns remain null. Do not invent unavailable telemetry or treat these records as proof of savings.

Append adjudication with `persona run adjudicate decision.json`:

```json
{
  "run_id": "RUN_ID",
  "encounter_id": "ENCOUNTER_ID",
  "finding_id": "finding-1",
  "artifact_version": "review-v1",
  "author": "reviewer-name",
  "disposition": "source-confirmed",
  "evidence_locator": "snapshot/files/docs/product.md:12",
  "verification_note": "The named source contradicts the quoted local-only claim."
}
```

`source-confirmed`, `refuted`, and `reclassified` require a source locator and note naming the exact claim checked. Preferences, praise and requests use `editorial-accepted` or `deferred`. Existing findings use their explicit `finding_id` or a one-based fallback such as `finding-1`. Optional `accepted_changes` is a list of `{path,before_sha256,after_sha256}` linking the accepted finding to file edits. Corrections name `correction_of` and append a new record. No command overwrites the raw encounter or an existing evidence record.

`persona run evidence RUN_ID` lists adjudications and dispatch receipts. `persona run report RUN_ID` shows raw reviewer assertions, adjudication history, accepted edit hashes and dispatch lineage. A legacy `verified: confirmed` enum alone does not establish a verified defect or human outcome. Attachment refuses different artifact versions, slugs, snapshot digests, personas or lanes; incompatible CLI saves are preserved explicitly unlinked.

Local writes serialize encounter saves and run mutations with bounded lock files. A crashed writer can leave a lock: inspect the named writer/process before removing that exact stale lock and retrying. The CLI never steals a lock automatically.
