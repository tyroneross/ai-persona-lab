"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CouncilType, ReviewLevel, ReviewRunStatus } from "@lib/council";
import { reviewLevelBounds } from "@lib/council";
import { fileCouncilRepository } from "@lib/council-repository.server";
import { filePersonaRepository } from "@lib/persona-repository.server";
import { buildOutcomeComparison } from "@lib/prompt-comparison";
import { plannerOutputToDraft, runPersonaPlanner } from "@lib/persona-plan-adapter";
import { buildRosterInputFromPersonas } from "@lib/council-library-adapter";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function listFromText(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePersonaIds(ids: string[], level: ReviewLevel, fallback: string[]): string[] {
  const bounds = reviewLevelBounds[level];
  if (ids.length >= bounds.min && ids.length <= bounds.max) return ids;
  return fallback;
}

export async function createCouncilRunAction(formData: FormData) {
  const rosterId = text(formData, "roster_id");
  const level = text(formData, "level") as ReviewLevel;
  const councilType = text(formData, "council_type") as CouncilType;
  const request = text(formData, "request");
  const targetArtifacts = listFromText(text(formData, "target_artifacts"));
  const selectedPersonaIds = formData.getAll("persona_ids").map(String);
  const runsPerPersona = Number(text(formData, "runs_per_persona")) || 1;
  const usePlanner = formData.get("use_planner") === "on";

  const roster = await fileCouncilRepository.getRoster(rosterId);
  if (!roster) throw new Error(`Roster ${rosterId} not found.`);

  const personaIds = normalizePersonaIds(selectedPersonaIds, level, roster.default_levels[level]);
  const targets = targetArtifacts.length > 0 ? targetArtifacts : ["Request brief"];

  if (usePlanner) {
    const planner = await runPersonaPlanner(request, level);
    const draft = plannerOutputToDraft(planner, roster, {
      repoPath: roster.repo_path,
      councilType,
      level,
      targetArtifacts: targets,
      coordinationMode: text(formData, "coordination_mode") as "local" | "host_subagents" | "rally",
    });
    const bundle = await fileCouncilRepository.createRun(
      { ...draft.run, persona_ids: personaIds, runs_per_persona: runsPerPersona },
      draft.measurementPlan,
    );
    revalidatePath("/councils");
    redirect(`/councils/${bundle.run.id}`);
  }

  const bundle = await fileCouncilRepository.createRun(
    {
      repo_path: roster.repo_path,
      request,
      council_type: councilType,
      level,
      target_artifacts: targets,
      roster_id: roster.id,
      persona_ids: personaIds,
      runs_per_persona: runsPerPersona,
      coordination_mode: text(formData, "coordination_mode") as "local" | "host_subagents" | "rally",
    },
    {
      decision_supported: text(formData, "decision_supported") || request,
      target_artifact: targets.join(", "),
      success_signals: listFromText(text(formData, "success_signals")),
      failure_signals: listFromText(text(formData, "failure_signals")),
      evidence_required: listFromText(text(formData, "evidence_required")),
      confidence_policy:
        text(formData, "confidence_policy") ||
        "Separate evidence confidence from synthesis confidence in every finding.",
      synthetic_policy:
        text(formData, "synthetic_policy") ||
        "Disclose synthetic, mixed, and expert-opinion claims before launch.",
      reviewer_quality_gate: text(formData, "reviewer_quality_gate") || undefined,
      predicted_outcomes: listFromText(text(formData, "predicted_outcomes")),
    },
  );

  revalidatePath("/councils");
  redirect(`/councils/${bundle.run.id}`);
}

export async function createRosterFromLibraryAction(formData: FormData) {
  const name = text(formData, "roster_name") || undefined;
  const selectedIds = formData.getAll("persona_ids").map(String).filter(Boolean);

  const { personas } = await filePersonaRepository.exportPersonas(
    selectedIds.length > 0 ? selectedIds : undefined,
  );
  const usable = personas.filter((p) => p.status !== "archived");

  const roster = await fileCouncilRepository.createRoster(
    buildRosterInputFromPersonas(usable, { repoPath: process.cwd(), name }),
  );

  revalidatePath("/councils");
  redirect(`/councils/new?roster=${roster.id}`);
}

export async function updateCouncilRunStatusAction(formData: FormData) {
  const runId = text(formData, "run_id");
  const status = text(formData, "status") as ReviewRunStatus;
  const expectedUpdatedAt = text(formData, "updated_at") || undefined;
  await fileCouncilRepository.updateRunStatus({
    id: runId,
    status,
    expected_updated_at: expectedUpdatedAt,
  });
  revalidatePath("/councils");
  revalidatePath(`/councils/${runId}`);
}

export async function refreshOutcomeComparisonAction(formData: FormData) {
  const runId = text(formData, "run_id");
  const bundle = await fileCouncilRepository.getRunBundle(runId);
  if (!bundle) throw new Error(`Run ${runId} not found.`);
  const prompts = await fileCouncilRepository.listPromptVersions(runId);
  await fileCouncilRepository.setOutcomeComparison(buildOutcomeComparison(bundle, prompts));
  revalidatePath(`/councils/${runId}`);
}
