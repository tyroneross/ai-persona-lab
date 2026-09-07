---
description: Autonomously drive an AI User Personas council run to completion — spawn one independent pass per persona, record findings, synthesize.
---

Drive a council run to completion. Input:

```text
$ARGUMENTS
```

`$ARGUMENTS` is either an existing `run_id`, or a request to create and run one
(e.g. `--topic "review the settings page" --level medium --runs 3`).

App base URL: `${APP_URL:-http://localhost:3000}` (the AI User Personas app must
be running: `npm run web:dev` from the persona-lab repository root). All state lives in the app; you drive it
over the council API.

## Steps

1. **Resolve the run.**
   - If given a `run_id`: `GET {base}/api/councils/{run_id}` → the bundle.
   - Otherwise create one: `POST {base}/api/councils/rosters` (build a roster from
     the saved library personas), then `POST {base}/api/councils/runs` with
     `{roster_id, request, level, runs_per_persona}`. Then GET the bundle.
   - If the GET/POST fails to connect, stop and tell the user to start the app.

2. **Budget gate (hard — do not skip).**
   Compute `total_passes = persona_ids.length * (runs_per_persona || 1)`.
   If `total_passes > 20`, DO NOT spawn any subagents. Stop and ask the user to
   confirm, showing the count and that each pass is an LLM call. Only proceed
   when the invocation explicitly authorized it (e.g. contains `--yes`) or the
   user confirms. This gate exists because each pass costs real tokens.

3. **Mark running.**
   `PATCH {base}/api/councils/{run_id}/status {"status":"ready"}` then
   `{"status":"running"}`.

4. **Run the passes — independently.**
   For each persona in `bundle.roster.personas`, run `runs_per_persona`
   INDEPENDENT passes. Launch one subagent per pass with NO shared transcript, so
   no pass sees another's findings (this prevents groupthink / diversity
   collapse). Give each subagent only: the persona (name, lens, role,
   `job_to_be_done`, `failure_modes`, `evidence_expectations`), the
   `target_artifacts`, and the measurement plan. Instruct each to:
   - Review the targets strictly from that persona's lens.
   - Surface anti-goals (what would make this persona abandon or distrust it).
   - Abstain ("cannot judge from available evidence") rather than fabricate.
   - Ensure at least one pass takes an adversarial / red-team stance.
   - Return a structured finding, or none if there is genuinely no concern.
   - Ask everything in this dispatch: a pass is unreachable ~30s after it
     finishes, so anything it cannot settle goes into `unanswered`, not into a
     follow-up turn.
   - If the persona exists in the library, write an encounter file BEFORE
     returning (`persona encounter new <persona_id> --artifact <slug> --version
     <frozen-version>`, fill it in, `persona encounter save -`) and return the
     path. A council `finding` is a lossy extraction; the encounter keeps the
     `verbatim` it came from. See `docs/persona-memory.md`.

   Freeze `target_artifacts` and record a version before step 4 begins.

5. **Record findings.** For each finding:
   `POST {base}/api/councils/{run_id}/findings` with
   `{"finding":{"persona_id","severity","claim","recommended_action",
   "evidence_confidence","synthesis_confidence","behavior_source":"synthesized",
   "source_uris":["path:line"]}}`. Batch with `{"findings":[...]}` if preferred.

6. **Synthesize and complete.** Cluster and dedupe findings; PRESERVE conflicts
   as `dissent_map` (do not average them away); keep dissenting critical
   findings. Then `PUT {base}/api/councils/{run_id}/synthesis` with
   `{"synthesis":{"decision_recommendation","top_findings","dissent_map",
   "evidence_gaps","recommended_next_actions"}}`. This advances the run to
   `complete`.

7. **Report** the bottom line, priority findings (severity + evidence +
   provenance), preserved conflicts, and the run URL
   `{base}/councils/{run_id}`. Stamp the output "hypothesis, not validation".
