import type { SourceType } from "./persona";

export type ReviewLevel = "low" | "medium" | "high";

export type CouncilType =
  | "ui_test"
  | "decision"
  | "strategy"
  | "prompt"
  | "research"
  | "architecture"
  | "competitive";

export type CoordinationMode = "local" | "host_subagents" | "rally";

export type ReviewRunStatus =
  | "draft"
  | "ready"
  | "running"
  | "needs_evidence"
  | "synthesizing"
  | "complete"
  | "archived";

export type AssignmentStatus = "queued" | "running" | "landed" | "failed" | "skipped";

export type FindingSeverity = "critical" | "high" | "medium" | "low";

export type BehaviorSource = "real_users" | "synthesized" | "expert_opinion" | "mixed";

export type RosterLens =
  | "user"
  | "buyer"
  | "operator"
  | "product"
  | "design"
  | "engineering"
  | "data"
  | "revenue"
  | "risk"
  | "support"
  | "executive"
  | "domain";

export type ModelTier = "haiku" | "sonnet" | "opus" | "frontier" | "human";

export type PromptSource = "native" | "prompt_builder" | "agent_builder_export";

export type RosterPersona = {
  id: string;
  name: string;
  lens: RosterLens;
  role: string;
  job_to_be_done: string;
  decision_power: string;
  failure_modes: string[];
  evidence_expectations: string[];
  default_use_cases: CouncilType[];
};

export type RepoPersonaRoster = {
  schema_version: "1.0.0";
  id: string;
  repo_path: string;
  repo_slug: string;
  source_summary: string;
  personas: RosterPersona[];
  default_levels: Record<ReviewLevel, string[]>;
  generated_from: string[];
  user_overrides: string[];
  created_at: string;
  updated_at: string;
};

export type PersonaMeasurementPlan = {
  schema_version: "1.0.0";
  id: string;
  run_id: string;
  decision_supported: string;
  target_artifact: string;
  success_signals: string[];
  failure_signals: string[];
  evidence_required: string[];
  confidence_policy: string;
  synthetic_policy: string;
  reviewer_quality_gate?: string;
  predicted_outcomes?: string[];
  pre_registered_at: string;
  updated_at: string;
};

export type PersonaReviewRun = {
  schema_version: "1.0.0";
  id: string;
  repo_path: string;
  request: string;
  council_type: CouncilType;
  level: ReviewLevel;
  target_artifacts: string[];
  roster_id: string;
  persona_ids: string[];
  /** Independent review passes per persona (1-100). Defaults to 1. */
  runs_per_persona?: number;
  measurement_plan_id: string;
  status: ReviewRunStatus;
  coordination_mode: CoordinationMode;
  created_at: string;
  updated_at: string;
};

export type PersonaAssignment = {
  schema_version: "1.0.0";
  id: string;
  run_id: string;
  persona_id: string;
  prompt_version_id?: string;
  model_tier: ModelTier;
  status: AssignmentStatus;
  output_path?: string;
  evidence_gaps: string[];
  error?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
};

export type PersonaFinding = {
  schema_version: "1.0.0";
  id: string;
  run_id: string;
  assignment_id: string;
  persona_id: string;
  severity: FindingSeverity;
  claim: string;
  evidence_ids: string[];
  source_uris: string[];
  assumptions: string[];
  evidence_confidence: number;
  synthesis_confidence: number;
  behavior_source: BehaviorSource;
  is_synthetic_disclosed: boolean;
  recommended_action: string;
  created_at: string;
};

export type PersonaSynthesis = {
  schema_version: "1.0.0";
  id: string;
  run_id: string;
  top_findings: string[];
  dissent_map: string[];
  evidence_gaps: string[];
  confidence_downgrade_reasons: string[];
  recommended_next_actions: string[];
  decision_recommendation: string;
  created_at: string;
  updated_at: string;
};

export type PromptVersion = {
  schema_version: "1.0.0";
  id: string;
  run_id: string;
  family: "selection" | "assignment" | "synthesis" | "qc";
  variant: ReviewLevel;
  model_tier: ModelTier;
  source: PromptSource;
  prompt_path?: string;
  score?: {
    clarity: number;
    constraints: number;
    determinism: number;
    completeness: number;
    model_tier_fit: number;
    evidence_discipline: number;
  };
  changelog: string[];
  created_at: string;
  updated_at: string;
};

export type RunEvent = {
  schema_version: "1.0.0";
  id: string;
  run_id: string;
  operation: string;
  actor: "user" | "codex" | "claude_code" | "rally" | "system";
  status_before?: ReviewRunStatus;
  status_after?: ReviewRunStatus;
  outcome: "success" | "warning" | "failure";
  message: string;
  created_at: string;
};

export type OutcomeComparison = {
  schema_version: "1.0.0";
  id: string;
  run_id: string;
  baseline_run_id?: string;
  prompt_builder_run_id?: string;
  agent_builder_export_id?: string;
  coverage_notes: string;
  evidence_quality_notes: string;
  actionability_notes: string;
  cost_time_notes: string;
  reuse_notes: string;
  created_at: string;
  updated_at: string;
};

export type CommandPacket = {
  run_id: string;
  coordination_mode: CoordinationMode;
  title: string;
  commands: string[];
  warnings: string[];
};

export type CouncilEvidenceItem = {
  id: string;
  source_type: SourceType;
  behavior_source: BehaviorSource;
  is_synthetic_disclosed: boolean;
  source_uri?: string;
  title?: string;
  quote?: string;
  summary: string;
  coverage_count?: number;
  evidence_confidence: number;
  synthesis_confidence: number;
  observed_at?: string;
};

export type PersonaReviewBundle = {
  run: PersonaReviewRun;
  roster: RepoPersonaRoster;
  measurement_plan: PersonaMeasurementPlan;
  assignments: PersonaAssignment[];
  findings: PersonaFinding[];
  synthesis?: PersonaSynthesis;
  events: RunEvent[];
  outcome_comparison?: OutcomeComparison;
};

export type PersonaReviewRunSummary = Pick<
  PersonaReviewRun,
  | "id"
  | "request"
  | "council_type"
  | "level"
  | "status"
  | "coordination_mode"
  | "created_at"
  | "updated_at"
> & {
  persona_count: number;
  finding_count: number;
  evidence_gap_count: number;
};

export type PersonaReviewRunFilters = {
  status?: ReviewRunStatus[];
  level?: ReviewLevel[];
  council_type?: CouncilType[];
  search?: string;
};

export type RepoPersonaRosterInput = Omit<
  RepoPersonaRoster,
  "schema_version" | "id" | "created_at" | "updated_at"
>;

export type PersonaReviewRunInput = Omit<
  PersonaReviewRun,
  "schema_version" | "id" | "status" | "created_at" | "updated_at"
>;

export type PersonaMeasurementPlanInput = Omit<
  PersonaMeasurementPlan,
  "schema_version" | "id" | "pre_registered_at" | "updated_at"
>;

export type PersonaReviewRunDraftInput = Omit<
  PersonaReviewRun,
  "schema_version" | "id" | "status" | "measurement_plan_id" | "created_at" | "updated_at"
>;

export type RunStatusUpdateInput = {
  id: string;
  status: ReviewRunStatus;
  message?: string;
  expected_updated_at?: string;
};

export type PersonaMeasurementPlanDraftInput = Omit<
  PersonaMeasurementPlan,
  "schema_version" | "id" | "run_id" | "pre_registered_at" | "updated_at"
>;

export const reviewLevelBounds: Record<ReviewLevel, { min: number; max: number }> = {
  low: { min: 1, max: 3 },
  medium: { min: 2, max: 6 },
  high: { min: 3, max: 20 },
};

/**
 * A persona can be reviewed multiple times (independent passes) within one run.
 * Above WARN, the run should surface a token-cost warning.
 */
export const runsPerPersonaBounds = { min: 1, max: 100, warnAbove: 20 } as const;

export const statusTransitions: Record<ReviewRunStatus, ReviewRunStatus[]> = {
  draft: ["ready", "archived"],
  ready: ["running", "needs_evidence", "archived"],
  running: ["needs_evidence", "synthesizing", "archived"],
  needs_evidence: ["draft", "ready", "running", "archived"],
  synthesizing: ["complete", "needs_evidence", "archived"],
  complete: ["archived"],
  archived: [],
};

export const councilTypeLabels: Record<CouncilType, string> = {
  ui_test: "UI test",
  decision: "Decision",
  strategy: "Strategy",
  prompt: "Prompt",
  research: "Research",
  architecture: "Architecture",
  competitive: "Competitive",
};

export const reviewLevelLabels: Record<ReviewLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function isRealSourceType(sourceType: SourceType): boolean {
  return sourceType !== "synthetic" && sourceType !== "desk_research";
}
