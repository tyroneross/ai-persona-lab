/**
 * Persona domain types — mirror schemas/persona.schema.json (v1.0.0).
 * Codex owns the canonical schema; this file is the TS view the UI reads.
 */

export type PersonaStatus = "draft" | "active" | "archived";

export type SourceType =
  | "interview"
  | "survey"
  | "analytics"
  | "support"
  | "sales"
  | "desk_research"
  | "synthetic";

export type TechComfort = "low" | "medium" | "high";

export type DecisionStyle = "fast" | "deliberate" | "consensus" | "authority-led";

export type Provenance =
  | "proto"
  | "qualitative"
  | "synthetic-grounded"
  | "synthetic-assumed";

export type SchemaVersion = "1.0.0" | "1.1.0";

export type Scenario = {
  title: string;
  description: string;
};

export type EvidenceItem = {
  id: string;
  source_type: SourceType;
  title?: string;
  source_uri?: string;
  quote?: string;
  summary: string;
  confidence: number;
  observed_at?: string;
};

export type Persona = {
  schema_version: SchemaVersion;
  id: string;
  status: PersonaStatus;
  name: string;
  archetype: string;
  role: string;
  summary: string;
  primary_goal: string;
  /** JTBD job-story: "When [situation], I want to [motivation], so I can [outcome]." */
  job_to_be_done?: string;
  /** What would make this persona abandon or distrust the product. */
  anti_goals?: string[];
  /** Basis for the persona; synthetic-* means hypothesis, not validated user research. */
  provenance?: Provenance;
  goals: string[];
  frustrations: string[];
  motivations: string[];
  behaviors: string[];
  needs: string[];
  scenarios: Scenario[];
  evidence: EvidenceItem[];
  confidence: number;
  tags: string[];
  quote?: string;
  channels?: string[];
  tech_comfort?: TechComfort;
  decision_style?: DecisionStyle;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type PersonaSummary = Pick<
  Persona,
  | "id"
  | "status"
  | "name"
  | "archetype"
  | "role"
  | "summary"
  | "primary_goal"
  | "confidence"
  | "tags"
  | "updated_at"
>;

export type PersonaFilters = {
  search?: string;
  status?: PersonaStatus[];
  tags?: string[];
  role?: string;
  minConfidence?: number;
  sourceType?: SourceType[];
};

export type PersonaCreateInput = Omit<
  Persona,
  "id" | "schema_version" | "created_at" | "updated_at"
>;

export type PersonaUpdateInput = Partial<PersonaCreateInput>;

export type PersonaExport = {
  schema_version: SchemaVersion;
  personas: Persona[];
};
