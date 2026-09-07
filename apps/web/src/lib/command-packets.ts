import type { CommandPacket, PersonaReviewBundle } from "./council";
import { runsPerPersonaBounds } from "./council";

function quote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function buildCommandPacket(bundle: PersonaReviewBundle): CommandPacket {
  const run = bundle.run;
  const targetList = run.target_artifacts.map(quote).join(" ");
  const runsPerPersona = run.runs_per_persona ?? 1;
  const totalPasses = run.persona_ids.length * runsPerPersona;
  const base = "${APP_URL:-http://localhost:3000}";
  const warnings: string[] = [];

  if (totalPasses > runsPerPersonaBounds.warnAbove) {
    warnings.push(
      `${totalPasses} total review passes (${run.persona_ids.length} personas x ${runsPerPersona}) exceeds ${runsPerPersonaBounds.warnAbove}; expect significant token usage.`,
    );
  }
  if (run.level === "high") {
    warnings.push("High-depth runs should be launched in waves if agent count exceeds host concurrency.");
  }
  if (bundle.measurement_plan.evidence_required.length === 0) {
    warnings.push("Measurement plan is missing evidence requirements.");
  }
  warnings.push("Run each persona's pass INDEPENDENTLY (no shared transcript). Output is hypothesis, not validated user research.");

  const rallyPreamble =
    run.coordination_mode === "rally"
      ? [
          'export RALLY="${RALLY:-/Users/tyroneross/dev/git-folder/agent-rally-point/target/release/rally}"',
          `"${"$"}RALLY" room --json`,
          `"${"$"}RALLY" say claim --tool codex --subject ${quote(`run ${run.id} persona review`)} --path ${quote(`run:${run.id}`)} --json`,
        ]
      : [];

  const commands = [
    ...rallyPreamble,
    `# Run ${run.id} — ${run.level} ${run.council_type} review`,
    `# Targets: ${targetList || "(none)"}`,
    `# Personas: ${run.persona_ids.length} x ${runsPerPersona} pass(es) = ${totalPasses} independent reviews.`,
    `# 1. Optional plan scaffold from the shared library:`,
    `persona panel ${quote(run.request)} --level ${run.level}`,
    `# 2. Mark the run running:`,
    `curl -sX PATCH ${base}/api/councils/${run.id}/status -H 'content-type: application/json' -d '{"status":"ready"}'`,
    `curl -sX PATCH ${base}/api/councils/${run.id}/status -H 'content-type: application/json' -d '{"status":"running"}'`,
    `# 3. For EACH persona pass, run the review against the targets, then record each finding:`,
    `curl -sX POST ${base}/api/councils/${run.id}/findings -H 'content-type: application/json' \\`,
    `  -d '{"finding":{"persona_id":"${run.persona_ids[0] ?? "<persona_id>"}","severity":"high","claim":"...","recommended_action":"...","evidence_confidence":0.5,"synthesis_confidence":0.5,"behavior_source":"synthesized","source_uris":["path:line"]}}'`,
    `# 4. Record synthesis (preserve conflicts as dissent_map); this advances the run to complete:`,
    `curl -sX PUT ${base}/api/councils/${run.id}/synthesis -H 'content-type: application/json' \\`,
    `  -d '{"synthesis":{"decision_recommendation":"...","top_findings":["..."],"dissent_map":["..."],"evidence_gaps":["..."]}}'`,
  ];

  return {
    run_id: run.id,
    coordination_mode: run.coordination_mode,
    title: `${run.level} ${run.council_type} review`,
    commands,
    warnings,
  };
}
