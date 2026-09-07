import type {
  EvidenceItem,
  Persona,
  PersonaCreateInput,
  PersonaStatus,
  SourceType,
} from "./persona";
import { evidenceId } from "./id";

export type PersonaValidationError = {
  path: string;
  message: string;
};

export type PersonaValidationResult = {
  ok: boolean;
  errors: PersonaValidationError[];
};

const sourceTypes: SourceType[] = [
  "interview",
  "survey",
  "analytics",
  "support",
  "sales",
  "desk_research",
  "synthetic",
];

const statuses: PersonaStatus[] = ["draft", "active", "archived"];

function error(path: string, message: string): PersonaValidationError {
  return { path, message };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function numberInRange(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : fallback;
}

function sourceType(value: unknown): SourceType {
  return sourceTypes.includes(value as SourceType) ? (value as SourceType) : "synthetic";
}

function status(value: unknown): PersonaStatus {
  return statuses.includes(value as PersonaStatus) ? (value as PersonaStatus) : "draft";
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

export function normalizePersonaInput(value: unknown, existing?: Persona): PersonaCreateInput {
  const record = asRecord(value);
  const scenarios = Array.isArray(record.scenarios)
    ? record.scenarios.map((item) => {
        const scenario = asRecord(item);
        return {
          title: text(scenario.title),
          description: text(scenario.description),
        };
      })
    : [];

  const evidence = Array.isArray(record.evidence)
    ? record.evidence.map((item, index): EvidenceItem => {
        const evidenceRecord = asRecord(item);
        const summary = text(evidenceRecord.summary);
        const title = text(evidenceRecord.title);
        const existingEvidence = existing?.evidence[index];
        return {
          id:
            text(evidenceRecord.id) ||
            existingEvidence?.id ||
            evidenceId(title || summary || "evidence"),
          source_type: sourceType(evidenceRecord.source_type),
          title: title || undefined,
          source_uri: text(evidenceRecord.source_uri) || undefined,
          quote: text(evidenceRecord.quote) || undefined,
          summary,
          confidence: numberInRange(evidenceRecord.confidence, 0.5),
          observed_at: text(evidenceRecord.observed_at) || undefined,
        };
      })
    : [];

  const provenanceValues = [
    "proto",
    "qualitative",
    "synthetic-grounded",
    "synthetic-assumed",
  ];
  const antiGoals = textList(record.anti_goals);

  return {
    status: status(record.status),
    name: text(record.name),
    archetype: text(record.archetype),
    role: text(record.role),
    summary: text(record.summary),
    primary_goal: text(record.primary_goal),
    job_to_be_done: text(record.job_to_be_done) || undefined,
    anti_goals: antiGoals.length ? antiGoals : undefined,
    provenance: provenanceValues.includes(record.provenance as string)
      ? (record.provenance as PersonaCreateInput["provenance"])
      : undefined,
    goals: textList(record.goals),
    frustrations: textList(record.frustrations),
    motivations: textList(record.motivations),
    behaviors: textList(record.behaviors),
    needs: textList(record.needs),
    scenarios,
    evidence,
    confidence: numberInRange(record.confidence, 0.5),
    tags: Array.from(new Set(textList(record.tags))),
    quote: text(record.quote) || undefined,
    channels: textList(record.channels),
    tech_comfort:
      record.tech_comfort === "low" ||
      record.tech_comfort === "medium" ||
      record.tech_comfort === "high"
        ? record.tech_comfort
        : undefined,
    decision_style:
      record.decision_style === "fast" ||
      record.decision_style === "deliberate" ||
      record.decision_style === "consensus" ||
      record.decision_style === "authority-led"
        ? record.decision_style
        : undefined,
    notes: text(record.notes) || undefined,
  };
}

export function validatePersona(persona: Persona): PersonaValidationResult {
  const errors: PersonaValidationError[] = [];

  if (persona.schema_version !== "1.0.0" && persona.schema_version !== "1.1.0") {
    errors.push(error("schema_version", "Persona schema_version must be 1.0.0 or 1.1.0."));
  }
  if (!nonEmpty(persona.id)) errors.push(error("id", "Persona id is required."));
  if (!statuses.includes(persona.status)) errors.push(error("status", "Persona status is invalid."));
  if (!nonEmpty(persona.name)) errors.push(error("name", "Name is required."));
  if (!nonEmpty(persona.archetype)) errors.push(error("archetype", "Archetype is required."));
  if (!nonEmpty(persona.role)) errors.push(error("role", "Role is required."));
  if (persona.summary.trim().length < 40 || persona.summary.trim().length > 600) {
    errors.push(error("summary", "Summary must be 40-600 characters."));
  }
  if (!nonEmpty(persona.primary_goal)) errors.push(error("primary_goal", "Primary goal is required."));
  if (!nonEmptyList(persona.goals)) errors.push(error("goals", "At least one goal is required."));
  if (!nonEmptyList(persona.frustrations)) {
    errors.push(error("frustrations", "At least one frustration is required."));
  }
  if (!nonEmptyList(persona.motivations)) {
    errors.push(error("motivations", "At least one motivation is required."));
  }
  if (!nonEmptyList(persona.behaviors)) {
    errors.push(error("behaviors", "At least one behavior is required."));
  }
  if (!nonEmptyList(persona.needs)) errors.push(error("needs", "At least one need is required."));
  if (!confidence(persona.confidence)) {
    errors.push(error("confidence", "Confidence must be between 0 and 1."));
  }
  if (!Array.isArray(persona.scenarios) || persona.scenarios.length === 0) {
    errors.push(error("scenarios", "At least one scenario is required."));
  }
  persona.scenarios.forEach((scenario, index) => {
    if (!nonEmpty(scenario.title)) errors.push(error(`scenarios.${index}.title`, "Scenario title is required."));
    if (scenario.description.trim().length < 20) {
      errors.push(error(`scenarios.${index}.description`, "Scenario description must be at least 20 characters."));
    }
  });
  if (!Array.isArray(persona.evidence) || persona.evidence.length === 0) {
    errors.push(error("evidence", "At least one evidence item is required."));
  }
  persona.evidence.forEach((item, index) => {
    if (!nonEmpty(item.id)) errors.push(error(`evidence.${index}.id`, "Evidence id is required."));
    if (!sourceTypes.includes(item.source_type)) {
      errors.push(error(`evidence.${index}.source_type`, "Evidence source type is invalid."));
    }
    if (!nonEmpty(item.summary)) {
      errors.push(error(`evidence.${index}.summary`, "Evidence summary is required."));
    }
    if (!confidence(item.confidence)) {
      errors.push(error(`evidence.${index}.confidence`, "Evidence confidence must be between 0 and 1."));
    }
  });

  return { ok: errors.length === 0, errors };
}

export function assertValidPersona(persona: Persona): void {
  const result = validatePersona(persona);
  if (!result.ok) {
    const details = result.errors.map((item) => `${item.path}: ${item.message}`).join("; ");
    throw new Error(`Persona validation failed: ${details}`);
  }
}
