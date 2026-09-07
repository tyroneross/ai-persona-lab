import "server-only";

import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  CouncilType,
  PersonaMeasurementPlanDraftInput,
  PersonaReviewRunDraftInput,
  RepoPersonaRoster,
  ReviewLevel,
} from "./council";

const execFileAsync = promisify(execFile);

type PlannerPersona = {
  name: string;
  perspective: string;
  primaryQuestion: string;
  successSignal: string;
  failureSignal: string;
};

type PlannerOutput = {
  request: string;
  inferredIntent: string;
  researchRecommended: boolean;
  accessNeeds: string[];
  personas: PlannerPersona[];
  measurement: string[];
  launchSteps: string[];
};

function countForLevel(level: ReviewLevel): number {
  if (level === "low") return 3;
  if (level === "medium") return 5;
  return 8;
}

export async function runPersonaPlanner(request: string, level: ReviewLevel): Promise<PlannerOutput> {
  const { stdout } = await execFileAsync(
    process.execPath,
    [path.resolve(process.cwd(), "../../scripts/persona-plan.mjs"), "--json", "--count", String(countForLevel(level)), request],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 },
  );
  return JSON.parse(stdout) as PlannerOutput;
}

export function plannerOutputToDraft(
  output: PlannerOutput,
  roster: RepoPersonaRoster,
  options: {
    repoPath: string;
    councilType: CouncilType;
    level: ReviewLevel;
    targetArtifacts: string[];
    coordinationMode?: "local" | "host_subagents" | "rally";
  },
): {
  run: PersonaReviewRunDraftInput;
  measurementPlan: PersonaMeasurementPlanDraftInput;
} {
  const personaIds = roster.default_levels[options.level];
  const successSignals = output.personas.map((persona) => persona.successSignal).filter(Boolean);
  const failureSignals = output.personas.map((persona) => persona.failureSignal).filter(Boolean);
  return {
    run: {
      repo_path: options.repoPath,
      request: output.request,
      council_type: options.councilType,
      level: options.level,
      target_artifacts: options.targetArtifacts,
      roster_id: roster.id,
      persona_ids: personaIds,
      coordination_mode: options.coordinationMode ?? "local",
    },
    measurementPlan: {
      decision_supported: output.inferredIntent,
      target_artifact: options.targetArtifacts.join(", ") || "Request brief",
      success_signals:
        successSignals.length > 0
          ? successSignals
          : ["Persona findings cite evidence or explicit assumptions."],
      failure_signals:
        failureSignals.length > 0
          ? failureSignals
          : ["Findings cannot be traced to evidence or assumptions."],
      evidence_required:
        output.accessNeeds.length > 0
          ? output.accessNeeds
          : ["Target artifacts", "Persona roster", "Review request"],
      confidence_policy: "Separate evidence confidence from synthesis confidence in every finding.",
      synthetic_policy: "Disclose synthetic, mixed, and expert-opinion claims before launch and in exported reports.",
      reviewer_quality_gate: options.level === "high" ? "Require dissent capture and outcome tracking." : undefined,
      predicted_outcomes: output.measurement,
    },
  };
}
