import { NextResponse } from "next/server";
import type { CouncilType, CoordinationMode, ReviewLevel } from "@lib/council";
import { reviewLevelBounds } from "@lib/council";
import { fileCouncilRepository } from "@lib/council-repository.server";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown, status = 400) {
  return NextResponse.json(
    {
      error: {
        code: status === 404 ? "not_found" : "validation_error",
        message: error instanceof Error ? error.message : "Run request failed.",
      },
    },
    { status },
  );
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((s) => s.trim()).filter(Boolean) : [];
}

/** GET council run summaries. */
export async function GET() {
  const runs = await fileCouncilRepository.listRuns();
  return NextResponse.json({ runs });
}

/** POST create a council run against an existing roster. Status starts `draft`. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rosterId = String(body?.roster_id ?? "");
    if (!rosterId) return errorResponse(new Error("roster_id is required."));

    const roster = await fileCouncilRepository.getRoster(rosterId);
    if (!roster) return errorResponse(new Error(`Roster ${rosterId} not found.`), 404);

    const level = (["low", "medium", "high"].includes(body?.level) ? body.level : "medium") as ReviewLevel;
    const councilType = (body?.council_type ?? "decision") as CouncilType;
    const request_ = String(body?.request ?? "").trim();
    if (!request_) return errorResponse(new Error("request is required."));

    const bounds = reviewLevelBounds[level];
    const requested = list(body?.persona_ids);
    const personaIds =
      requested.length >= bounds.min && requested.length <= bounds.max
        ? requested
        : roster.default_levels[level];
    const targets = list(body?.target_artifacts);
    const targetArtifacts = targets.length > 0 ? targets : ["Request brief"];

    const bundle = await fileCouncilRepository.createRun(
      {
        repo_path: roster.repo_path,
        request: request_,
        council_type: councilType,
        level,
        target_artifacts: targetArtifacts,
        roster_id: roster.id,
        persona_ids: personaIds,
        runs_per_persona: Number(body?.runs_per_persona) || 1,
        coordination_mode: (body?.coordination_mode ?? "local") as CoordinationMode,
      },
      {
        decision_supported: String(body?.decision_supported ?? request_),
        target_artifact: targetArtifacts.join(", "),
        success_signals: list(body?.success_signals).length
          ? list(body?.success_signals)
          : ["Findings cite evidence or a stated assumption", "Recommended actions are specific"],
        failure_signals: list(body?.failure_signals).length
          ? list(body?.failure_signals)
          : ["Findings cannot be traced to evidence", "No clear next action"],
        evidence_required: list(body?.evidence_required).length
          ? list(body?.evidence_required)
          : ["Target artifacts", "Persona roster"],
        confidence_policy:
          String(body?.confidence_policy ?? "") ||
          "Separate evidence confidence from synthesis confidence in every finding.",
        synthetic_policy:
          String(body?.synthetic_policy ?? "") ||
          "Disclose synthetic and mixed evidence before treating output as validated.",
      },
    );

    return NextResponse.json({ bundle }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
