import type {
  PersonaAssignment,
  PersonaFinding,
  PersonaMeasurementPlan,
  PersonaMeasurementPlanDraftInput,
  OutcomeComparison,
  PersonaReviewBundle,
  PersonaReviewRun,
  PersonaReviewRunDraftInput,
  PersonaReviewRunFilters,
  PersonaReviewRunSummary,
  PersonaSynthesis,
  PromptVersion,
  RepoPersonaRoster,
  RepoPersonaRosterInput,
  RunEvent,
  RunStatusUpdateInput,
  ReviewRunStatus,
} from "./council";
import { runsPerPersonaBounds } from "./council";
import { canTransitionStatus, assertValid, validateMeasurementPlan, validateRoster, validateRun } from "./council-validation";
import { prefixedId } from "./id";

export type CouncilRepository = {
  listRosters(): Promise<RepoPersonaRoster[]>;
  getRoster(id: string): Promise<RepoPersonaRoster | null>;
  createRoster(input: RepoPersonaRosterInput): Promise<RepoPersonaRoster>;
  listRuns(filters?: PersonaReviewRunFilters): Promise<PersonaReviewRunSummary[]>;
  getRunBundle(id: string): Promise<PersonaReviewBundle | null>;
  createRun(input: PersonaReviewRunDraftInput, measurementPlan: PersonaMeasurementPlanDraftInput): Promise<PersonaReviewBundle>;
  updateRunStatus(update: RunStatusUpdateInput): Promise<PersonaReviewRun>;
  addFinding(finding: PersonaFinding): Promise<PersonaFinding>;
  setSynthesis(synthesis: PersonaSynthesis): Promise<PersonaSynthesis>;
  listPromptVersions(runId?: string): Promise<PromptVersion[]>;
  addPromptVersion(prompt: PromptVersion): Promise<PromptVersion>;
  setOutcomeComparison(comparison: OutcomeComparison): Promise<OutcomeComparison>;
  appendRunEvent(event: Omit<RunEvent, "schema_version" | "id" | "created_at">): Promise<RunEvent>;
};

export type CouncilRepositoryStore = {
  rosters: RepoPersonaRoster[];
  runs: PersonaReviewRun[];
  measurementPlans: PersonaMeasurementPlan[];
  assignments: PersonaAssignment[];
  findings: PersonaFinding[];
  syntheses: PersonaSynthesis[];
  promptVersions: PromptVersion[];
  outcomeComparisons: OutcomeComparison[];
  events: RunEvent[];
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

function runSummary(store: CouncilRepositoryStore, run: PersonaReviewRun): PersonaReviewRunSummary {
  const findings = store.findings.filter((finding) => finding.run_id === run.id);
  const assignments = store.assignments.filter((assignment) => assignment.run_id === run.id);
  return {
    id: run.id,
    request: run.request,
    council_type: run.council_type,
    level: run.level,
    status: run.status,
    coordination_mode: run.coordination_mode,
    created_at: run.created_at,
    updated_at: run.updated_at,
    persona_count: run.persona_ids.length,
    finding_count: findings.length,
    evidence_gap_count: assignments.reduce((count, assignment) => count + assignment.evidence_gaps.length, 0),
  };
}

function matchesRun(run: PersonaReviewRun, filters: PersonaReviewRunFilters): boolean {
  if (filters.status && filters.status.length > 0 && !filters.status.includes(run.status)) {
    return false;
  }
  if (filters.level && filters.level.length > 0 && !filters.level.includes(run.level)) {
    return false;
  }
  if (
    filters.council_type &&
    filters.council_type.length > 0 &&
    !filters.council_type.includes(run.council_type)
  ) {
    return false;
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const hay = [run.request, run.council_type, run.level, run.status, ...run.target_artifacts]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export function createEmptyCouncilStore(): CouncilRepositoryStore {
  return {
    rosters: [],
    runs: [],
    measurementPlans: [],
    assignments: [],
    findings: [],
    syntheses: [],
    promptVersions: [],
    outcomeComparisons: [],
    events: [],
  };
}

export function createCouncilRepository(
  initialStore: CouncilRepositoryStore = createEmptyCouncilStore(),
): CouncilRepository {
  const store = initialStore;

  return {
    async listRosters() {
      return clone(store.rosters).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },

    async getRoster(id) {
      const roster = store.rosters.find((item) => item.id === id);
      return roster ? clone(roster) : null;
    },

    async createRoster(input) {
      const timestamp = nowIso();
      const roster: RepoPersonaRoster = {
        ...input,
        schema_version: "1.0.0",
        id: prefixedId("roster", input.repo_slug),
        created_at: timestamp,
        updated_at: timestamp,
      };
      assertValid(validateRoster(roster), "Roster");
      store.rosters.unshift(roster);
      return clone(roster);
    },

    async listRuns(filters = {}) {
      return store.runs
        .filter((run) => matchesRun(run, filters))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((run) => runSummary(store, run));
    },

    async getRunBundle(id) {
      const run = store.runs.find((item) => item.id === id);
      if (!run) return null;
      const roster = store.rosters.find((item) => item.id === run.roster_id);
      const measurementPlan = store.measurementPlans.find((item) => item.id === run.measurement_plan_id);
      if (!roster || !measurementPlan) return null;
      return {
        run: clone(run),
        roster: clone(roster),
        measurement_plan: clone(measurementPlan),
        assignments: clone(store.assignments.filter((assignment) => assignment.run_id === id)),
        findings: clone(store.findings.filter((finding) => finding.run_id === id)),
        synthesis: clone(store.syntheses.find((synthesis) => synthesis.run_id === id)),
        outcome_comparison: clone(store.outcomeComparisons.find((comparison) => comparison.run_id === id)),
        events: clone(store.events.filter((event) => event.run_id === id)),
      };
    },

    async createRun(input, measurementPlanInput) {
      const timestamp = nowIso();
      const runId = prefixedId("run", `${input.council_type}-${input.level}`);
      const measurementPlanId = prefixedId("measurement", runId);
      const runsPerPersona = Math.min(
        Math.max(Math.round(input.runs_per_persona ?? 1), runsPerPersonaBounds.min),
        runsPerPersonaBounds.max,
      );
      const run: PersonaReviewRun = {
        ...input,
        runs_per_persona: runsPerPersona,
        schema_version: "1.0.0",
        id: runId,
        measurement_plan_id: measurementPlanId,
        status: "draft",
        created_at: timestamp,
        updated_at: timestamp,
      };
      const roster = store.rosters.find((item) => item.id === run.roster_id);
      assertValid(validateRun(run, roster), "Run");

      const measurementPlan: PersonaMeasurementPlan = {
        ...measurementPlanInput,
        schema_version: "1.0.0",
        id: measurementPlanId,
        run_id: run.id,
        pre_registered_at: timestamp,
        updated_at: timestamp,
      };
      assertValid(validateMeasurementPlan(measurementPlan), "Measurement plan");

      const assignments: PersonaAssignment[] = run.persona_ids.flatMap((personaId) =>
        Array.from({ length: runsPerPersona }, (_, pass) => ({
          schema_version: "1.0.0" as const,
          id: prefixedId("assignment", `${run.id}-${personaId}-${pass}`),
          run_id: run.id,
          persona_id: personaId,
          model_tier: "haiku" as const,
          status: "queued" as const,
          evidence_gaps: [],
          created_at: timestamp,
          updated_at: timestamp,
        })),
      );

      store.runs.unshift(run);
      store.measurementPlans.unshift(measurementPlan);
      store.assignments.unshift(...assignments);
      await this.appendRunEvent({
        run_id: run.id,
        operation: "create_run",
        actor: "codex",
        status_after: "draft",
        outcome: "success",
        message:
          runsPerPersona > 1
            ? `Draft persona review run created (${run.persona_ids.length} personas x ${runsPerPersona} passes = ${assignments.length} reviews).`
            : "Draft persona review run created.",
      });

      if (assignments.length > runsPerPersonaBounds.warnAbove) {
        await this.appendRunEvent({
          run_id: run.id,
          operation: "token_cost_warning",
          actor: "system",
          outcome: "warning",
          message: `${assignments.length} total review passes exceeds ${runsPerPersonaBounds.warnAbove}; expect significant token usage. Reduce personas or runs per persona to lower cost.`,
        });
      }

      const bundle = await this.getRunBundle(run.id);
      if (!bundle) throw new Error(`Run ${run.id} could not be loaded after create.`);
      return bundle;
    },

    async updateRunStatus({
      id,
      status,
      message = `Run moved to ${status}.`,
      expected_updated_at,
    }) {
      const index = store.runs.findIndex((run) => run.id === id);
      if (index === -1) throw new Error(`Run ${id} not found.`);
      const current = store.runs[index];
      if (expected_updated_at && current.updated_at !== expected_updated_at) {
        throw new Error(`Run ${id} changed since it was loaded.`);
      }
      if (!canTransitionStatus(current.status, status)) {
        throw new Error(`Cannot transition run ${id} from ${current.status} to ${status}.`);
      }
      const updated: PersonaReviewRun = { ...current, status, updated_at: nowIso() };
      store.runs[index] = updated;
      await this.appendRunEvent({
        run_id: id,
        operation: "update_status",
        actor: "codex",
        status_before: current.status,
        status_after: status,
        outcome: "success",
        message,
      });
      return clone(updated);
    },

    async addFinding(finding) {
      store.findings.unshift(clone(finding));
      return clone(finding);
    },

    async setSynthesis(synthesis) {
      const index = store.syntheses.findIndex((item) => item.run_id === synthesis.run_id);
      if (index === -1) store.syntheses.unshift(clone(synthesis));
      else store.syntheses[index] = clone(synthesis);
      return clone(synthesis);
    },

    async listPromptVersions(runId) {
      return clone(store.promptVersions)
        .filter((prompt) => !runId || prompt.run_id === runId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },

    async addPromptVersion(prompt) {
      store.promptVersions.unshift(clone(prompt));
      return clone(prompt);
    },

    async setOutcomeComparison(comparison) {
      const index = store.outcomeComparisons.findIndex((item) => item.run_id === comparison.run_id);
      if (index === -1) store.outcomeComparisons.unshift(clone(comparison));
      else store.outcomeComparisons[index] = clone(comparison);
      return clone(comparison);
    },

    async appendRunEvent(eventInput) {
      const event: RunEvent = {
        ...eventInput,
        schema_version: "1.0.0",
        id: prefixedId("event", `${eventInput.run_id}-${eventInput.operation}`),
        created_at: nowIso(),
      };
      store.events.unshift(event);
      return clone(event);
    },
  };
}

export const councilRepository: CouncilRepository = createCouncilRepository();
