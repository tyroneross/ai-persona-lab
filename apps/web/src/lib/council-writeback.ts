/**
 * Build validated council findings and synthesis from the lightweight drafts a
 * coding agent (or human) posts back after running a persona review. This closes
 * the execution loop: the app emits a command packet, a host agent runs the
 * passes, then writes results back through the council API using these helpers.
 */

import type {
  BehaviorSource,
  FindingSeverity,
  PersonaFinding,
  PersonaReviewBundle,
  PersonaSynthesis,
} from "./council";
import { assertValid, validateFinding } from "./council-validation";
import { prefixedId } from "./id";

export type FindingDraft = {
  persona_id: string;
  assignment_id?: string;
  severity?: FindingSeverity;
  claim: string;
  recommended_action: string;
  evidence_confidence?: number;
  synthesis_confidence?: number;
  behavior_source?: BehaviorSource;
  evidence_ids?: string[];
  source_uris?: string[];
  assumptions?: string[];
  is_synthetic_disclosed?: boolean;
};

export type SynthesisDraft = {
  top_findings?: string[];
  dissent_map?: string[];
  evidence_gaps?: string[];
  confidence_downgrade_reasons?: string[];
  recommended_next_actions?: string[];
  decision_recommendation: string;
};

const SEVERITIES: FindingSeverity[] = ["critical", "high", "medium", "low"];
const BEHAVIOR_SOURCES: BehaviorSource[] = ["real_users", "synthesized", "expert_opinion", "mixed"];

function clamp01(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((s) => s.trim()).filter(Boolean) : [];
}

/**
 * Resolve the assignment a finding attaches to. Prefers an explicit id, else the
 * first assignment for the persona in the run.
 */
export function resolveAssignmentId(bundle: PersonaReviewBundle, draft: FindingDraft): string {
  if (draft.assignment_id) {
    const match = bundle.assignments.find((a) => a.id === draft.assignment_id);
    if (!match) throw new Error(`Assignment ${draft.assignment_id} is not part of run ${bundle.run.id}.`);
    return match.id;
  }
  const forPersona = bundle.assignments.find((a) => a.persona_id === draft.persona_id);
  if (!forPersona) {
    throw new Error(`No assignment for persona ${draft.persona_id} in run ${bundle.run.id}.`);
  }
  return forPersona.id;
}

/** Build a validated PersonaFinding from a draft. Throws on invalid input. */
export function buildFinding(bundle: PersonaReviewBundle, draft: FindingDraft, now: string): PersonaFinding {
  if (!draft.persona_id) throw new Error("persona_id is required.");
  const behaviorSource: BehaviorSource = BEHAVIOR_SOURCES.includes(draft.behavior_source as BehaviorSource)
    ? (draft.behavior_source as BehaviorSource)
    : "synthesized";
  const finding: PersonaFinding = {
    schema_version: "1.0.0",
    id: prefixedId("finding", `${bundle.run.id}-${draft.persona_id}`),
    run_id: bundle.run.id,
    assignment_id: resolveAssignmentId(bundle, draft),
    persona_id: draft.persona_id,
    severity: SEVERITIES.includes(draft.severity as FindingSeverity)
      ? (draft.severity as FindingSeverity)
      : "medium",
    claim: String(draft.claim ?? "").trim(),
    evidence_ids: list(draft.evidence_ids),
    source_uris: list(draft.source_uris),
    assumptions: list(draft.assumptions),
    evidence_confidence: clamp01(draft.evidence_confidence, 0.4),
    synthesis_confidence: clamp01(draft.synthesis_confidence, 0.4),
    behavior_source: behaviorSource,
    is_synthetic_disclosed:
      draft.is_synthetic_disclosed ?? behaviorSource !== "real_users",
    recommended_action: String(draft.recommended_action ?? "").trim(),
    created_at: now,
  };
  assertValid(validateFinding(finding), "Finding");
  return finding;
}

/** Build a PersonaSynthesis from a draft. */
export function buildSynthesis(bundle: PersonaReviewBundle, draft: SynthesisDraft, now: string): PersonaSynthesis {
  const decision = String(draft.decision_recommendation ?? "").trim();
  if (!decision) throw new Error("decision_recommendation is required.");
  return {
    schema_version: "1.0.0",
    id: prefixedId("synthesis", bundle.run.id),
    run_id: bundle.run.id,
    top_findings: list(draft.top_findings),
    dissent_map: list(draft.dissent_map),
    evidence_gaps: list(draft.evidence_gaps),
    confidence_downgrade_reasons: list(draft.confidence_downgrade_reasons),
    recommended_next_actions: list(draft.recommended_next_actions),
    decision_recommendation: decision,
    created_at: now,
    updated_at: now,
  };
}
