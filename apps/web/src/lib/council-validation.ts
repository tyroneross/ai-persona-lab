import type {
  CouncilEvidenceItem,
  PersonaAssignment,
  PersonaFinding,
  PersonaMeasurementPlan,
  PersonaReviewRun,
  RepoPersonaRoster,
  ReviewRunStatus,
} from "./council";
import { isRealSourceType, reviewLevelBounds, statusTransitions } from "./council";

export type ValidationError = {
  path: string;
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  errors: ValidationError[];
};

function error(path: string, message: string): ValidationError {
  return { path, message };
}

function nonEmpty(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function nonEmptyList(values: string[] | undefined): boolean {
  return Array.isArray(values) && values.some((value) => nonEmpty(value));
}

function confidence(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateRoster(roster: RepoPersonaRoster): ValidationResult {
  const errors: ValidationError[] = [];

  if (roster.schema_version !== "1.0.0") {
    errors.push(error("schema_version", "Roster schema_version must be 1.0.0."));
  }
  if (!nonEmpty(roster.id)) errors.push(error("id", "Roster id is required."));
  if (!nonEmpty(roster.repo_path)) errors.push(error("repo_path", "Repo path is required."));
  if (!nonEmpty(roster.repo_slug)) errors.push(error("repo_slug", "Repo slug is required."));
  if (!nonEmpty(roster.source_summary)) {
    errors.push(error("source_summary", "Source summary is required."));
  }
  if (!Array.isArray(roster.personas) || roster.personas.length === 0) {
    errors.push(error("personas", "Roster must include at least one persona."));
  }

  const personaIds = new Set<string>();
  roster.personas.forEach((persona, index) => {
    const base = `personas.${index}`;
    if (!nonEmpty(persona.id)) errors.push(error(`${base}.id`, "Persona id is required."));
    if (personaIds.has(persona.id)) errors.push(error(`${base}.id`, "Persona id must be unique."));
    personaIds.add(persona.id);
    if (!nonEmpty(persona.name)) errors.push(error(`${base}.name`, "Persona name is required."));
    if (!nonEmpty(persona.role)) errors.push(error(`${base}.role`, "Persona role is required."));
    if (!nonEmpty(persona.job_to_be_done)) {
      errors.push(error(`${base}.job_to_be_done`, "Persona JTBD is required."));
    }
    if (!nonEmptyList(persona.failure_modes)) {
      errors.push(error(`${base}.failure_modes`, "At least one failure mode is required."));
    }
    if (!nonEmptyList(persona.evidence_expectations)) {
      errors.push(error(`${base}.evidence_expectations`, "At least one evidence expectation is required."));
    }
  });

  (["low", "medium", "high"] as const).forEach((level) => {
    const ids = roster.default_levels[level] ?? [];
    const bounds = reviewLevelBounds[level];
    if (ids.length < bounds.min || ids.length > bounds.max) {
      errors.push(
        error(
          `default_levels.${level}`,
          `${level} level must include ${bounds.min}-${bounds.max} personas.`,
        ),
      );
    }
    ids.forEach((id) => {
      if (!personaIds.has(id)) {
        errors.push(error(`default_levels.${level}`, `Unknown persona id: ${id}.`));
      }
    });
  });

  return { ok: errors.length === 0, errors };
}

export function validateMeasurementPlan(plan: PersonaMeasurementPlan): ValidationResult {
  const errors: ValidationError[] = [];
  if (plan.schema_version !== "1.0.0") {
    errors.push(error("schema_version", "Measurement plan schema_version must be 1.0.0."));
  }
  if (!nonEmpty(plan.id)) errors.push(error("id", "Measurement plan id is required."));
  if (!nonEmpty(plan.run_id)) errors.push(error("run_id", "Measurement plan run_id is required."));
  if (!nonEmpty(plan.decision_supported)) {
    errors.push(error("decision_supported", "Decision supported is required."));
  }
  if (!nonEmpty(plan.target_artifact)) {
    errors.push(error("target_artifact", "Target artifact is required."));
  }
  if (!nonEmptyList(plan.success_signals)) {
    errors.push(error("success_signals", "At least one success signal is required."));
  }
  if (!nonEmptyList(plan.failure_signals)) {
    errors.push(error("failure_signals", "At least one failure signal is required."));
  }
  if (!nonEmptyList(plan.evidence_required)) {
    errors.push(error("evidence_required", "At least one evidence requirement is required."));
  }
  if (!nonEmpty(plan.confidence_policy)) {
    errors.push(error("confidence_policy", "Confidence policy is required."));
  }
  if (!nonEmpty(plan.synthetic_policy)) {
    errors.push(error("synthetic_policy", "Synthetic policy is required."));
  }
  return { ok: errors.length === 0, errors };
}

export function validateRun(run: PersonaReviewRun, roster?: RepoPersonaRoster): ValidationResult {
  const errors: ValidationError[] = [];
  if (run.schema_version !== "1.0.0") {
    errors.push(error("schema_version", "Run schema_version must be 1.0.0."));
  }
  if (!nonEmpty(run.id)) errors.push(error("id", "Run id is required."));
  if (!nonEmpty(run.repo_path)) errors.push(error("repo_path", "Repo path is required."));
  if (!nonEmpty(run.request)) errors.push(error("request", "Review request is required."));
  if (!Array.isArray(run.target_artifacts) || run.target_artifacts.length === 0) {
    errors.push(error("target_artifacts", "At least one target artifact is required."));
  }
  const bounds = reviewLevelBounds[run.level];
  if (run.persona_ids.length < bounds.min || run.persona_ids.length > bounds.max) {
    errors.push(error("persona_ids", `${run.level} level must include ${bounds.min}-${bounds.max} personas.`));
  }
  if (roster) {
    const rosterIds = new Set(roster.personas.map((persona) => persona.id));
    run.persona_ids.forEach((id) => {
      if (!rosterIds.has(id)) errors.push(error("persona_ids", `Unknown roster persona id: ${id}.`));
    });
  }
  return { ok: errors.length === 0, errors };
}

export function validateAssignment(assignment: PersonaAssignment): ValidationResult {
  const errors: ValidationError[] = [];
  if (assignment.schema_version !== "1.0.0") {
    errors.push(error("schema_version", "Assignment schema_version must be 1.0.0."));
  }
  if (!nonEmpty(assignment.id)) errors.push(error("id", "Assignment id is required."));
  if (!nonEmpty(assignment.run_id)) errors.push(error("run_id", "Assignment run_id is required."));
  if (!nonEmpty(assignment.persona_id)) errors.push(error("persona_id", "Assignment persona_id is required."));
  return { ok: errors.length === 0, errors };
}

export function validateFinding(finding: PersonaFinding): ValidationResult {
  const errors: ValidationError[] = [];
  if (finding.schema_version !== "1.0.0") {
    errors.push(error("schema_version", "Finding schema_version must be 1.0.0."));
  }
  if (!nonEmpty(finding.id)) errors.push(error("id", "Finding id is required."));
  if (!nonEmpty(finding.claim)) errors.push(error("claim", "Finding claim is required."));
  if (!nonEmpty(finding.recommended_action)) {
    errors.push(error("recommended_action", "Recommended action is required."));
  }
  if (!confidence(finding.evidence_confidence)) {
    errors.push(error("evidence_confidence", "Evidence confidence must be between 0 and 1."));
  }
  if (!confidence(finding.synthesis_confidence)) {
    errors.push(error("synthesis_confidence", "Synthesis confidence must be between 0 and 1."));
  }
  if (finding.evidence_ids.length === 0 && finding.source_uris.length === 0 && finding.assumptions.length === 0) {
    errors.push(
      error("evidence_ids", "Finding must cite evidence, a source URI, or an explicit assumption."),
    );
  }
  if (finding.behavior_source !== "real_users" && !finding.is_synthetic_disclosed) {
    errors.push(error("is_synthetic_disclosed", "Non-real-user findings must disclose synthetic status."));
  }
  return { ok: errors.length === 0, errors };
}

export function validateCouncilEvidenceItem(item: CouncilEvidenceItem): ValidationResult {
  const errors: ValidationError[] = [];
  if (!nonEmpty(item.id)) errors.push(error("id", "Evidence id is required."));
  if (!nonEmpty(item.summary)) errors.push(error("summary", "Evidence summary is required."));
  if (!confidence(item.evidence_confidence)) {
    errors.push(error("evidence_confidence", "Evidence confidence must be between 0 and 1."));
  }
  if (!confidence(item.synthesis_confidence)) {
    errors.push(error("synthesis_confidence", "Synthesis confidence must be between 0 and 1."));
  }
  if (isRealSourceType(item.source_type) && !nonEmpty(item.source_uri)) {
    errors.push(error("source_uri", "Real-source evidence must include source_uri."));
  }
  if (item.behavior_source !== "real_users" && !item.is_synthetic_disclosed) {
    errors.push(error("is_synthetic_disclosed", "Synthetic or mixed evidence must be disclosed."));
  }
  return { ok: errors.length === 0, errors };
}

export function canTransitionStatus(from: ReviewRunStatus, to: ReviewRunStatus): boolean {
  return statusTransitions[from].includes(to);
}

export function assertValid(result: ValidationResult, label: string): void {
  if (!result.ok) {
    const details = result.errors.map((err) => `${err.path}: ${err.message}`).join("; ");
    throw new Error(`${label} validation failed: ${details}`);
  }
}
